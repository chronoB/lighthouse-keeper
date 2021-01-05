const fs = require("fs")
const lighthouse = require("lighthouse")
const chromeLauncher = require("chrome-launcher")

let mutex = false
let summary = {}
// counter that is used to track the number of running/waiting lighthouse processes
// used to track when the summary can be written
let processCounter = 0

//TODO: Save Results
//TODO: Don't crawl http sites. only save a note that there is one
//TODO: Don't crawl redirecting sites.

async function runLighthouse(website, folder, summaryObj) {
    if (mutex) {
        let timeout = 1000
        setTimeout(() => {
            runLighthouse(website, folder, summaryObj)
        }, timeout)
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

    // `.lhr` is the Lighthouse Result as a JS object
    let percentFactor = 100
    console.log("Report is done for", runnerResult.lhr.finalUrl)
    console.log(
        "Performance score was",
        runnerResult.lhr.categories.performance.score * percentFactor
    )
    console.log(
        "SEO score was",
        runnerResult.lhr.categories.seo.score * percentFactor
    )
    console.log(
        "Accessibility score was",
        runnerResult.lhr.categories.accessibility.score * percentFactor
    )
    console.log(
        "best-practices score was",
        runnerResult.lhr.categories["best-practices"].score * percentFactor
    )
    //add this to summary.json
    await chrome.kill()
    mutex = false
    saveResults(runnerResult, website, folder, summaryObj)
    // process ended, reduce counter
    processCounter--
    console.log("Anzahl Prozesse: " + processCounter)
}

function saveResults(runnerResult, website, folder, summaryObj) {
    // save json files
    const report = runnerResult.report
    let urlSplit = website.split("/")
    let urlID = urlSplit[urlSplit.length - 2] //last element of url is always ""
    if (urlID.includes(".de") || urlID.includes(".com")) {
        urlID = "main_" + urlSplit[0] //add http/https to distinguish
        urlID = urlID.substring(0, urlID.length - 1) //remove : from string
    }
    let fileURI =
        folder + "/" + getCurrentDate() + "/" + urlID + "_lhreport.json"
    fileCounter = 1
    while (fs.existsSync(fileURI)) {
        fileURI =
            folder +
            "/" +
            getCurrentDate() +
            "/" +
            urlID +
            "_lhreport" +
            fileCounter +
            ".json"
        fileCounter++
    }
    fs.writeFileSync(fileURI, report)

    //generate basescores and save it to the summaryobject
    summaryObj[urlID] = {}
    summaryObj[urlID].performanceScore =
        runnerResult.lhr.categories.performance.score * percentFactor
    summaryObj[urlID].seoScore =
        runnerResult.lhr.categories.seo.score * percentFactor
    summaryObj[urlID].accessibilityScore =
        runnerResult.lhr.categories.accessibility.score * percentFactor
    summaryObj[urlID].bestPracticesScore =
        runnerResult.lhr.categories["best-practices"].score * percentFactor
}

fs.readdir("urls", (errReadDir, directories) => {
    if (errReadDir) {
        console.error(errReadDir)
        return
    }
    directories.forEach((directory) => {
        fs.stat("urls/" + directory, (errStats, stats) => {
            if (errStats) {
                console.error(errStats)
                return
            }
            if (stats.isDirectory()) {
                let folder = "urls/" + directory
                //if (directory === "vor-gaenge.de") return //TODO: remove after test
                //if (directory === "parallachs.de") return //TODO: remove after test
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
                                processCounter++
                                console.log(
                                    "Anzahl Prozesse: " + processCounter
                                )
                                runLighthouse(
                                    url,
                                    folder,
                                    summary[directory]
                                ).catch(() => {
                                    processCounter--
                                    console.log(
                                        "Anzahl Prozesse: " + processCounter
                                    )
                                })
                            }
                        })
                        writeSummary(folder)
                    }
                )
            }
        })
    })
})

function writeSummary(folder) {
    let timeout = 1000
    if (processCounter) {
        setTimeout(() => {
            writeSummary(folder)
        }, timeout)
        return
    }

    fs.writeFileSync(
        "urls/" + getCurrentDate() + "/summary.json",
        JSON.stringify(summary)
    )
}

function getCurrentDate() {
    let maxNumChars = 2

    let today = new Date()
    let dd = String(today.getDate()).padStart(maxNumChars, "0")
    let mm = String(today.getMonth() + 1).padStart(maxNumChars, "0") //January is 0!
    let yyyy = today.getFullYear()

    return yyyy + mm + dd
}
