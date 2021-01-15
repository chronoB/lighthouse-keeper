const fs = require("fs")
const lighthouse = require("lighthouse")
const chromeLauncher = require("chrome-launcher")

class LighthouseKeeper {
    constructor() {
        this.mutex = false
        // counter that is used to track the number of running/waiting lighthouse processes
        // used to track when the summary can be written
        this.processCounter = 0
        this.percentFactor = 100
        this.timeoutForMutexChecks = 1000
    }

    async runLighthouseWrapper(website, folder, summaryObj) {
        this.processCounter++
        console.log("Anzahl Prozesse: " + this.processCounter)
        await this.runLighthouse(website, folder, summaryObj).catch((err) => {
            console.log(err)
            this.processCounter--
            console.log("Anzahl Prozesse: " + this.processCounter)
        })
    }

    async runLighthouse(website, folder, summaryObj) {
        if (this.mutex) {
            setTimeout(() => {
                this.runLighthouse(website, folder, summaryObj)
            }, this.timeoutForMutexChecks)
            return
        }
        console.log("Grabbing mutex for " + website)
        this.mutex = true

        const chrome = await chromeLauncher.launch({
            chromeFlags: ["--headless"],
        })
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

        this.outputLHInformation(runnerResult)

        await chrome.kill()
        this.mutex = false
        this.saveResults(runnerResult, website, folder, summaryObj)
        // process ended, reduce counter
        this.processCounter--
        console.log("Anzahl Prozesse: " + this.processCounter)
    }

    writeSummary(folder, summary) {
        let timeout = 1000
        if (this.processCounter) {
            setTimeout(() => {
                this.writeSummary(folder, summary)
            }, timeout)
            return
        }

        //write specific summary for every domain
        let keys = Object.keys(summary)
        for (let i = 0; i < keys.length; i++) {
            let completeFolder = folder + "/" + this.getCurrentDate() + "/"
            let file = "summary.json"
            this.writeFile(completeFolder, file, summary[keys[i]])
        }
    }

    saveResults(runnerResult, website, folder, summaryObj) {
        // save json files
        const report = runnerResult.report
        let urlSplit = website.split("/")
        let urlID = urlSplit[urlSplit.length - 2] //last element of url is always ""
        if (urlID.includes(".de") || urlID.includes(".com")) {
            urlID = "main_" + urlSplit[0] //add http/https to distinguish
            urlID = urlID.substring(0, urlID.length - 1) //remove : from string
        }
        let currentDate = this.getCurrentDate()
        let completeFolder = folder + "/" + currentDate + "/"
        let file = urlID + "_lhreport.json"
        let fileURI = completeFolder + file
        let fileCounter = 1
        while (fs.existsSync(fileURI)) {
            file = urlID + "_lhreport" + fileCounter + ".json"
            fileURI = completeFolder + file
            fileCounter++
        }

        this.writeFile(completeFolder, file, report)

        //generate basescores and save it to the summaryobject
        summaryObj[urlID] = {}
        summaryObj[urlID].performanceScore =
            runnerResult.lhr.categories.performance.score * this.percentFactor
        summaryObj[urlID].seoScore =
            runnerResult.lhr.categories.seo.score * this.percentFactor
        summaryObj[urlID].accessibilityScore =
            runnerResult.lhr.categories.accessibility.score * this.percentFactor
        summaryObj[urlID].bestPracticesScore =
            runnerResult.lhr.categories["best-practices"].score *
            this.percentFactor
    }

    getCurrentDate() {
        let maxNumChars = 2

        let today = new Date()
        let dd = String(today.getDate()).padStart(maxNumChars, "0")
        let mm = String(today.getMonth() + 1).padStart(maxNumChars, "0") //January is 0!
        let yyyy = today.getFullYear()

        return yyyy + mm + dd
    }

    writeFile(folder, file, data) {
        if (!fs.existsSync(folder)) {
            fs.mkdirSync(folder)
        }
        //complete summary
        fs.writeFileSync(folder + file, JSON.stringify(data))
    }

    isActive() {
        return this.processCounter > 0
    }

    outputLHInformation(runnerResult) {
        // `.lhr` is the Lighthouse Result as a JS object
        console.log("Report is done for", runnerResult.lhr.finalUrl)
        console.log(
            "Performance score was",
            runnerResult.lhr.categories.performance.score * this.percentFactor
        )
        console.log(
            "SEO score was",
            runnerResult.lhr.categories.seo.score * this.percentFactor
        )
        console.log(
            "Accessibility score was",
            runnerResult.lhr.categories.accessibility.score * this.percentFactor
        )
        console.log(
            "best-practices score was",
            runnerResult.lhr.categories["best-practices"].score *
                this.percentFactor
        )
    }
}

module.exports = LighthouseKeeper
