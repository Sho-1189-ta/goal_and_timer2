import * as vscode from 'vscode';


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
                        }
                    },
                    undefined,
                    context.subscriptions
                );
            }
        })
    );

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