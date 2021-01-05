const fs = require("fs")
const lighthouse = require("lighthouse")
const chromeLauncher = require("chrome-launcher")

let mutex = false

async function runLighthouse(website, folder) {
    while (mutex) {
        setTimeout(() => {
            runLighthouse(website, folder)
        }, 1000)
        return
    }
    console.log("Grabbing mutex for " + website)
    mutex = true
    const chrome = await chromeLauncher.launch({ chromeFlags: ["--headless"] })
    const options = {
        output: "json",
        onlyCategories: [
            "performance",
            "seo",
            "accessibility",
            "best-practices",
        ],
        port: chrome.port,
    }
    const runnerResult = await lighthouse(website, options)

    // `.report` is the HTML report as a string
    const reportHtml = runnerResult.report
    let stripURL = website.split("/")
    fs.writeFileSync(folder + "/" + stripURL[-1] + "lhreport.json", reportHtml)

    // `.lhr` is the Lighthouse Result as a JS object
    console.log("Report is done for", runnerResult.lhr.finalUrl)
    console.log(
        "Performance score was",
        runnerResult.lhr.categories.performance.score * 100
    )
    console.log("SEO score was", runnerResult.lhr.categories.seo.score * 100)
    console.log(
        "Accessibility score was",
        runnerResult.lhr.categories.accessibility.score * 100
    )
    console.log(
        "best-practices score was",
        runnerResult.lhr.categories["best-practices"].score * 100
    )
    //add this to summary.json
    await chrome.kill()
    mutex = false
}

fs.readdir("urls", (errReadDir, files) => {
    if (errReadDir) {
        console.error(errReadDir)
        return
    }
    files.forEach((file) => {
        fs.stat("urls/" + file, (errStats, stats) => {
            if (errStats) {
                console.error(errStats)
                return
            }
            if (stats.isDirectory()) {
                let folder = "urls/" + file
                if (file === "vor-gaenge.de") return
                fs.readFile(
                    folder + "/urls.txt",
                    "utf8",
                    (errReadFiles, data) => {
                        if (errReadFiles) {
                            console.error(errReadFiles)
                            return
                        }
                        let lines = data.split(/\r\n|\n/)
                        lines.forEach((url) => {
                            if (url !== "") {
                                runLighthouse(url, folder)
                            }
                        })
                    }
                )
            }
        })
    })
})

// iterate through urls directory
// for every folder
//  - create reports folder (if not exists)
//  - create folder with datetime
//  - create summary.json start
//  - read urls.txt line by line
//      - runLighthouse with webpage, link to folder which contains reports
//          - run lighthouse for webpage.
//          - save report for website.
//          - append summary to summary.json
//  - close summary.json

//  - use summary.json to conenct to a google sheet? Maybe send a report via mail? maybe send alarm?
