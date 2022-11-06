const fs = require('fs/promises');
const lodash = require("lodash")
const moment = require("moment")
const axios = require('axios');
const qs = require('qs');
require('colors');
var lastvalue;
var schedule;
var scannerarr = ["muhammad.rovalino", "satrio.sarjono", "miftachul.huda"]
var unit = ["021", "022", "023", "024", "025", "041"]
var username = 'miftachul.huda';
var password = 'turnigy9xHud4';

const listshift =
    [
        ["A1 Malam", "B2 Pagi", "C3 Sore", "D Off Malam"],
        ["A2 Malam", "B3 Pagi", "D1 Sore", "C Off Sore"],
        ["A3 Malam", "C1 Pagi", "D2 Sore", "B Off Pagi"],
        ["B1 Malam", "C2 Pagi", "D3 Sore", "A Off Malam"],
        ["B2 Malam", "C3 Pagi", "A1 Sore", "D Off Sore"],
        ["B3 Malam", "D1 Pagi", "A2 Sore", "C Off Pagi"],
        ["C1 Malam", "D2 Pagi", "A3 Sore", "B Off Malam"],
        ["C2 Malam", "D3 Pagi", "B1 Sore", "A Off Sore"],
        ["C3 Malam", "A1 Pagi", "B2 Sore", "D Off Pagi"],
        ["D1 Malam", "A2 Pagi", "B3 Sore", "C Off Malam"],
        ["D2 Malam", "A3 Pagi", "C1 Sore", "B Off Sore"],
        ["D3 Malam", "B1 Pagi", "C2 Sore", "A Off Pagi"]
    ]


function getPeriod(min) {
    if (min < 480) {
        return 0
    } if (min < 960) {
        return 1
    } else {
        return 2
    }
}

function checkShift() {
    var now = moment(new Date());
    var end = moment("2021-12-22");
    var duration = moment.duration(now.diff(end));
    var day = Math.trunc(duration.asDays()) % 12
    var minutes = Math.trunc(duration.asMinutes()) % 1440
    return listshift[day][getPeriod(minutes)];
}

function checkShiftPeriod() {
    var hours = moment().hours()
    if (hours < 4) {
        return "00:00"
    } else if (hours < 8) {
        return "04:00"
    } else if (hours < 12) {
        return "08:00"
    } else if (hours < 16) {
        return "12:00"
    } else if (hours < 20) {
        return "16:00"
    } else return "20:00"
}
async function callAxiosWithRetry(config, depth, failMassage) {
    const wait = (ms) => new Promise((res) => setTimeout(res, ms));
    try {
        return await axios(config)
    } catch (e) {
        if (depth > 20) {
            throw e;
        }
        console.log(failMassage.red)
        await wait(2 ** depth * 100);
        console.log("Retrying .. ".green + depth)
        return callAxiosWithRetry(config, depth + 1, failMassage);
    }
}

async function fire(user, pass) {
    var getTokenLogin = async function () {
        var data = qs.stringify({
            'username': user,
            'password': pass,
            'companyCode': '1010',
            'domainName': 'pertamina'
        });
        var config = {
            method: 'post',
            url: 'https://apps.pertamina.com/bocpp-v2.0/api/logins?secretKey=ee8fbc9dfa034db4a2419bfb4bfa9562',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            data: data
        };
        console.log("Send Login key....")
        return callAxiosWithRetry(config, 0, "Failed to Login Something Wrong").then(function (response) {
            console.log("Sucessfully Login to server".green)
            return response.data.token
        });

    }

    var getLastValue = async function (token) {
        var config = {
            method: 'get',
            url: 'https://apps.pertamina.com/bocpp-v2.0/api/lastValueRecords?bocpp=boc&ru=R401&area=LOC-II',
            headers: {
                'Authorization': `Bearer ${token}`
            },

        };
        console.log("Request Last Value, Please Wait....")
        return callAxiosWithRetry(config, 0, 'Failed to get Last Value Record').then(function (response) {
            console.log("Sucessfully Get Last Value From Server".green)
            return response.data
        });
    }
    var getSchedule = async function (token) {
        var config = {
            method: 'get',
            url: 'https://apps.pertamina.com/bocpp-v2.0/api/scheduleHistories?ru=R401&area=LOC-II',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        };
        console.log("Request Schedule History, Please Wait....")
        return callAxiosWithRetry(config, 0, "Failed to Get Schedule History").then(function (response) {
            console.log("Sucessfully Get Schedule History From Server".green)
            return response.data
        });


    }
    let state = true;
    const gettoken = await getTokenLogin()
    async function requireF(modulePath, err, cb) { // force require
        try {
            state = true
            return require(modulePath);
        }
        catch (e) {
            console.log(err.red)
            await cb()
            state = false
            return false;
        }
    }

    await (async function gettingReq() {
        lastvalue = await getLastValue(gettoken).then((v) => v).catch(() => {
            console.log("Failed Get Last Value From Server. Trying to Get From Disk".bgYellow)
            return requireF('./lastvalue.json', "Last value not available in the Disk", gettingReq)
        })

        fs.writeFile('lastvalue.json', JSON.stringify(lastvalue))
        schedule = await getSchedule(gettoken).then((v) => v).catch(() => {
            console.log("Failed Get Schedule From Server. Trying to Get From Disk".bgYellow)
            return requireF('./schedule.json', "Schedule not available in the Disk")
        })
        fs.writeFile('schedule.json', JSON.stringify(schedule))
    })()
    return [state, gettoken]
}
var filtering = function (state, unit, waktu, scanner, synctime) {
    if (state) {
        var nowschedule = lodash(schedule).filter({ "unit": unit, "shift": waktu, "status": "Running" }).value()
        var filteredschedule = nowschedule.filter(function (item) {
            if (item.equipment.substring(0, 4) == '041T' || item.equipment.substring(0, 4) == "TAPP") {
                return false
            } else
                return true;
        })
        var tosend = filteredschedule.map(item => {
            function radomize() {
                function randomInteger(min, max) {
                    return Math.floor(Math.random() * (max - min + 1) + min)
                }
                random = randomInteger(39, 120)
                return random
            }
            synctime = moment(synctime)
            function addSecond(date, second) {
                return (date + (second * 1000))
            }
            var lastvaluefilter = lodash(lastvalue).filter({ "idEquipment": item.idEquipment }).value()
            var lastvaluefilterconcat = Object.keys(lastvaluefilter).reduce(function (arr, key) {
                return arr.concat(lastvaluefilter[key]);
            }, []);

            var addtoday = addSecond(synctime, radomize())
            var date = moment(addtoday).format("YYYY-MM-DD HH:mm:ss").toString()
            var jam = moment(addtoday).format("HH:mm:ss").toString()
            synctime = addtoday

            return lastvaluefilterconcat.map(param => {

                return {
                    "idScheduleHistory": item.id,
                    "parentRecord": item.parentRecord,
                    "value": param.value,
                    "idParameter": param.idParameter,
                    "scanWith": "rfid",
                    "timestamp": date,
                    "scanBy": scanner,
                    "approved": 0,
                    "shift": jam,
                    "notesRecord": ""
                }
            })

        })
        var tosendconcat = Object.keys(tosend).reduce(function (arr, key) {
            return arr.concat(tosend[key]);
        }, [])
    } else {
        tosendconcat = null
    }

    return [tosendconcat, filteredschedule]
}

var syncronize = async function (tosend, token, unit, waktu) {
    var data = JSON.stringify(tosend);
    var config = {
        method: 'post',
        url: 'https://apps.pertamina.com/bocpp-v2.0/api/equipRecords/',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        data: data
    };
    console.log("Uploading Record Data...")
    return callAxiosWithRetry(config, 0, `Upload ${unit} time ${waktu} Failed`).then(function (response) {
        console.log("Sucessfully Sending Records".green)
        return response.data[0].Message
    });


}
//send message to telegram API
async function sendMessage(message) {
    let encoded = encodeURIComponent(message);
    var config = {
        method: 'post',
        url: `https://api.telegram.org/bot5266529032:AAG6oq2TOmKOXrt5qaeVLk3ehvYF0bJZ6ko/sendMessage?chat_id=-575255072&parse_mode=HTML&text=${encoded}`,
        headers: {}
    };

    await axios(config)
        .then(function (response) {
            console.log("Telegram message Sent");
        })
        .catch(function (error) {
            console.log("Failed sending Telegram message");
            console.log(error)
        });
}
var uploadscene = async function (state, unit, waktu, scanner, synctime, token) {

    var resultdata = filtering(state, unit, waktu, scanner, synctime)
    if (resultdata[1] != null && resultdata[0] != null) {
        await syncronize(resultdata[0], token, unit, waktu).then(async (x) => {
            console.log(`Upload ${Object.keys(resultdata[1]).length} Equip Record Unit ${unit} jam ${waktu} date ${resultdata[0][resultdata[0].length - 1].timestamp.blue} user ${scanner} Messages : ${x.blue}`)
            await sendMessage(`<b>${scanner}</b> Unit <b>${unit}</b> ${Object.keys(resultdata[1]).length} Equip Record ${waktu} date ${resultdata[0][resultdata[0].length - 1].timestamp} :[${x}]`)
        }).catch(() => {
            console.log("failed upload record")
        })
    } else {
        console.log("Data not available".red)
        await sendMessage("No records available to send")
    }

}
async function asyncForEach(array, callback) {
    for (let index = 0; index < array.length; index++) {
        await callback(array[index], index, array);
    }
}
const proceed = async function (params) {
    var date = moment().format("YYYY-MM-DD").toString();
    var waktu = checkShiftPeriod()
    var statentoken = await fire(params.username, params.password)
    function radomize() {
        function randomInteger(min, max) {
            return Math.floor(Math.random() * (max - min + 1) + min)
        }
        random = randomInteger(900, 1700)
        return random
    }
    function getRandomTime(time) {
        return moment(date + ' ' + time).add(radomize(), 'seconds').format("YYYY-MM-DD HH:mm:ss").toString()
    }
    var synctime = getRandomTime(waktu)
    await asyncForEach(params.unit, async (param) => {
        await asyncForEach(param[1], async (unit) => {
            console.log(statentoken[0], unit, waktu, param[0], synctime, statentoken[1])
            await uploadscene(statentoken[0], unit, waktu, param[0], synctime, statentoken[1])
        })
    })
}

var runit = async function () {
    var curshift = checkShift()
    switch (curshift[0]) {
        case "X":
            console.log("No Task")
            break;
        case "X":
            proceed({
                username: "allan.syahputra",
                password: "Pertaminaru4",
                unit: [["allan.syahputra", ["024"]]]
            })
            break;
        case "C":
            proceed({
                username: "muhammad.aulya",
                password: "Pertamina2022",
                unit: [["muhammad.aulya", ["023", "024"]]]
            })
            break;
        case "X":
            console.log("Custom")
            var params1 = {
                    username: "miftachul.huda",
                    password: "turnigy9xHud4",
                    unit: [["muhammad.rovalino", ["021", "022", "025"]], ["satrio.sarjono", ["023", "041"]]]
                }

            var params2 = {
                    username: "miftachul.huda",
                    password: "turnigy9xHud4",
                    unit: [["muhammad.rovalino", ["021", "002"]], ["miftachul.huda", ["022", "025"]], ["satrio.sarjono", ["023", "041"]], ["danariyanto", ["024"]]]

                }

            proceed(params2)
            break;
        default:
            console.log("Error no shift match")
            break;
    }

}
runit()
