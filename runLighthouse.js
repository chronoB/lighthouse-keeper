const fs = require("fs")
const lighthouse = require("lighthouse")
const chromeLauncher = require("chrome-launcher")

let mutex = false
// counter that is used to track the number of running/waiting lighthouse processes
// used to track when the summary can be written
let processCounter = 0

let percentFactor = 100

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
    let currentDate = getCurrentDate()
    let completeFolder = folder + "/" + currentDate + "/"
    let file = urlID + "_lhreport.json"
    let fileURI = completeFolder + file
    fileCounter = 1
    while (fs.existsSync(fileURI)) {
        file = urlID + "_lhreport" + fileCounter + ".json"
        fileURI = completeFolder + file
        fileCounter++
    }

    writeFile(completeFolder, file, report)

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
    let summary = {}
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
                        writeSummary(folder, summary)
                    }
                )
            }
        })
    })
})

function writeSummary(folder, summary) {
    let timeout = 1000
    if (processCounter) {
        setTimeout(() => {
            writeSummary(folder, summary)
        }, timeout)
        return
    }

    //write specific summary for every domain
    let keys = Object.keys(summary)
    for (let i = 0; i < keys.length; i++) {
        completeFolder = folder + "/" + getCurrentDate() + "/"
        let file = "summary.json"
        writeFile(completeFolder, file, summary[keys[i]])
    }
}

function getCurrentDate() {
    let maxNumChars = 2

    let today = new Date()
    let dd = String(today.getDate()).padStart(maxNumChars, "0")
    let mm = String(today.getMonth() + 1).padStart(maxNumChars, "0") //January is 0!
    let yyyy = today.getFullYear()

    return yyyy + mm + dd
}

function writeFile(folder, file, data) {
    if (!fs.existsSync(folder)) {
        fs.mkdirSync(folder)
    }
    //complete summary
    fs.writeFileSync(folder + file, JSON.stringify(data))
}
