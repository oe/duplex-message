import { app, BrowserWindow } from "electron";
import { MainMessageHub } from 'simple-electron-ipc'
import * as path from "path";
let mainWindow
const messageHub = new MainMessageHub()
messageHub.on('*', {
  getUserToken: (a, b) => Math.random().toString(36) + a + b,
  download: (msg) => {
    return new Promise((resolve, reject) => {
      let hiCount = 0
      const tid = setInterval(() => {
        if (hiCount >= 100) {
          clearInterval(tid)
          return resolve('done')
        }
        msg.onprogress({count: hiCount += 10})
      }, 200)
    })
  },
  async getTitle (t: string) {
    const title = await messageHub.emit(mainWindow, 'pageTitle')
    return t + '---' + title
  },
  calc (a, b) {
    return messageHub.emit(mainWindow, 'addNumber', {
      a,
      b,
      onprogress(e) {console.log('progress', e)}
    })
  }
})

function createWindow() {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    height: 600,
    webPreferences: {
      // webSecurity: false,
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
      // preload: path.join(__dirname, "preload.js"),
    },
    width: 800,
  });

  // and load the index.html of the app.
  mainWindow.loadFile(path.join(__dirname, "../index.html"));

  // Open the DevTools.
  mainWindow.webContents.openDevTools();
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on("ready", () => {
  createWindow();

  app.on("activate", function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// In this file you can include the rest of your app"s specific main process
// code. You can also put them in separate files and require them here.
