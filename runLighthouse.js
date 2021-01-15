const fs = require("fs")
const LighthouseKeeper = require("./src/LighthouseKeeper.js")

//TODO: Don't crawl http sites. only save a note that there is one
//TODO: Don't crawl redirecting sites.

let keeper = new LighthouseKeeper()

fs.readdir("urls", (errReadDir, directories) => {
    if (errReadDir) {
        console.error(errReadDir)
        return
    }
    let summary = {}
    directories.forEach((directory) => {
        fs.stat("urls/" + directory, (errStats, stats) => {
            if (errStats) {
                console.error(errStats)
                return
            }
            if (stats.isDirectory()) {
                let folder = "urls/" + directory
                if (directory === "vor-gaenge.de") return //TODO: remove after test
                if (directory === "parallachs.de") return //TODO: remove after test
                fs.readFile(
                    folder + "/urls.txt",
                    "utf8",
                    (errReadFiles, data) => {
                        if (errReadFiles) {
                            console.error(errReadFiles)
                            return
                        }
                        //create new object in summary
                        summary[directory] = {}
                        let lines = data.split(/\r\n|\n/)
                        lines.forEach((url) => {
                            if (url !== "") {
                                keeper.runLighthouseWrapper(
                                    url,
                                    folder,
                                    summary[directory]
                                )
                            }
                        })
                        keeper.writeSummary(folder, summary)
                    }
                )
            }
        })
    })
})
