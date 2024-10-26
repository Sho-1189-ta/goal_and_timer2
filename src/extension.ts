import * as vscode from 'vscode';
import { GEMINI_API_KEY } from './env';

export function activate(context: vscode.ExtensionContext) {
    let timer: NodeJS.Timeout | undefined;
    let isTimerRunning = false;
    let isPaused = false;
    let remainingTime: number = 0;

    // サイドバーに表示するビューコンテナを登録
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('functionTimerView', {
            resolveWebviewView(webviewView) {
                webviewView.webview.options = { enableScripts: true };
                webviewView.webview.html = getWebviewContent();

                webviewView.webview.onDidReceiveMessage(
                    (message) => {
                        if (message.command === 'startTimer') {
                            if (!isTimerRunning) {
                                const duration1 = parseInt(message.duration1, 10);
                                const duration2 = parseInt(message.duration2, 10);
                                remainingTime = duration1 * 60 + duration2;
                                startCountdown(webviewView);
                            }
                        } else if (message.command === 'toggleTimer') {
                            toggleTimer(webviewView);
                        } else if (message.command === 'updateRemainingTime') {
                            const duration1 = parseInt(message.duration1, 10);
                            const duration2 = parseInt(message.duration2, 10);
                            remainingTime = duration1 * 60 + duration2;
                            updateDisplayedTime(webviewView);
                        }else if (message.command === 'getHint') {
							// Gemini APIリクエスト
							getProgrammingHint(message.language, message.specification)
								.then((hint) => {
									webviewView.webview.postMessage({ command: 'showHint', hint });
								})
								.catch((error) => {
									console.error('Error fetching hint:', error);
									webviewView.webview.postMessage({ command: 'showHint', hint: 'ヒントの取得に失敗しました。' });
								});
						}
                    },
                    undefined,
                    context.subscriptions
                );
            }
        })
    );


	// // Gemini APIにリクエストを送り、ヒントを取得する関数
	// async function getProgrammingHint(language: string, specification: string): Promise<string> {
	// 	const prompt = `以下の条件に従って、仕様を満たすコードを書くためのヒントを書いてください。\n1 言語：${language}\n2 仕様：${specification}`;
		
	// 	// Gemini APIリクエストの送信
	// 	const response = await fetch('https://api.gemini.com/v1/chat', {
	// 		method: 'POST',
	// 		headers: {
	// 			'Content-Type': 'application/json',
	// 			'Authorization': GEMINI_API_KEY // ここにAPIキーを追加
	// 		},
	// 		body: JSON.stringify({ prompt })
	// 	});

	// 	const data = await response.json();
	// 	return data.hint || 'ヒントの取得に失敗しました。';
	// }

	async function getProgrammingHint(language: string, specification: string): Promise<string> {
		try {
			const prompt = `###プロンプト###\n以下の条件に従って、仕様を満たすコードを書くためのヒントを書いてください。字数は日本語で２００字程度です。\n###プログラミング言語###\n${language}\n###仕様###\n${specification}`;
			
			const response = await fetch(
				'https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=' + GEMINI_API_KEY,
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						contents: [{
							parts: [{
								text: prompt
							}]
						}]
					})
				}
			);
	
			if (!response.ok) {
				const errorText = await response.text();
				console.error('API Error:', errorText);
				throw new Error(`API request failed with status ${response.status}`);
			}
	
			const data = await response.json();
			
			// Gemini APIのレスポンス構造に基づいてテキストを抽出
			const hint = data.candidates?.[0]?.content?.parts?.[0]?.text;
			if (!hint) {
				throw new Error('APIからの応答が期待された形式ではありません');
			}
			
			return hint;
		} catch (error) {
			console.error('Error in getProgrammingHint:', error);
			return 'ヒントの取得に失敗しました: ' + (error as Error).message;
		}
	}

    function startCountdown(webviewView: vscode.WebviewView) {
        timer = setInterval(() => {
            if (!isPaused) {
                remainingTime--;
                updateDisplayedTime(webviewView);

                if (remainingTime <= 0) {
                    clearInterval(timer);
                    isTimerRunning = false;
                    isPaused = false;
                    webviewView.webview.postMessage({ command: 'timeUp' });
                }
            }
        }, 1000);
        isTimerRunning = true;
    }

    function toggleTimer(webviewView: vscode.WebviewView) {
        if (isTimerRunning) {
            if (isPaused) {
                isPaused = false;
                webviewView.webview.postMessage({ command: 'timerResumed' });
            } else {
                isPaused = true;
                webviewView.webview.postMessage({ command: 'timerPaused' });
            }
        }
    }

    function updateDisplayedTime(webviewView: vscode.WebviewView) {
        const minutes = Math.floor(remainingTime / 60);
        const seconds = remainingTime % 60;
        webviewView.webview.postMessage({
            command: 'updateTimer',
            time: `${minutes}:${seconds < 10 ? '0' + seconds : seconds}`
        });
    }
}

function getWebviewContent(): string {
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>コード・タイマー</title>
        </head>
        <body>
            <h1>コード・タイマー</h1>
            <form id="functionForm">
                <label for="functionName">作るものの概要:</label>
                <input type="text" id="functionName" name="functionName">
                <br><br>
                <label for="duration1">分:</label>
                <input type="number" id="duration1" name="duration1" min="1" max="60">
                <label for="duration2">秒:</label>
                <input type="number" id="duration2" name="duration2" min="0" max="60">
                <br><br>
                <button type="submit">スタート</button>
            </form>
            <br>
            <button id="toggleButton">停止 / 再開</button>

            <h2>残り時間: <span id="countdown">00:00</span></h2>


			<form id="hintForm">
				<label for="language">プログラミング言語：</label><br>
				<input type="test" id = "language" name = "language">
				<br><br>
				<label for="specification">仕様：</label><br>
				<textarea id="specification" name="specification"></textarea>
				<br><br>
				<button type="button" id = "getHintButton">ヒントを取得</button>
			</form>
			<h4>ヒント:</h4>
			<div id="hintOutput">ここにヒントが表示されます</div>


            <script>
                const vscode = acquireVsCodeApi();

                document.getElementById('functionForm').addEventListener('submit', event => {
                    event.preventDefault();
                    const duration1 = document.getElementById('duration1').value;
                    const duration2 = document.getElementById('duration2').value;
                    vscode.postMessage({ command: 'startTimer', duration1, duration2 });
                });

                document.getElementById('toggleButton').addEventListener('click', () => {
                    vscode.postMessage({ command: 'toggleTimer' });
                });



				document.getElementById("getHintButton").addEventListener("click",() =>{
					const language = document.getElementById("language").value;
					const specification = document.getElementById("specification").value;
					vscode.postMessage({command:"getHint",language,specification});
				});

				window.addEventListener('message', event => {
					const message = event.data;
					switch (message.command) {
						case 'showHint':
							document.getElementById('hintOutput').innerText = message.hint;
							break;
					}
				});



                document.getElementById('duration1').addEventListener('input', updateRemainingTime);
                document.getElementById('duration2').addEventListener('input', updateRemainingTime);

                function updateRemainingTime() {
                    const duration1 = document.getElementById('duration1').value || '0';
                    const duration2 = document.getElementById('duration2').value || '0';
                    vscode.postMessage({ command: 'updateRemainingTime', duration1, duration2 });
                }

                window.addEventListener('message', event => {
                    const message = event.data;
                    switch (message.command) {
                        case 'updateTimer':
                            document.getElementById('countdown').innerText = message.time;
                            break;
                        case 'timeUp':
                            alert('Time is up!');
                            break;
                        case 'timerPaused':
                            alert('Timer paused!');
                            break;
                        case 'timerResumed':
                            alert('Timer resumed!');
                            break;
                    }
                });
            </script>
        </body>
        </html>
    `;
}

export function deactivate() {}