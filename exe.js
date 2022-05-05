const fs = require('fs/promises');
const lodash = require("lodash")
const moment = require("moment")
const axios = require('axios');
const qs = require('qs');
require('colors');
var lastvalue;
var schedule;
var shift;
var scannerarr = ["muhammad.rovalino", "satrio.sarjono", "miftachul.huda"]
var unit = ["021", "022", "023", "024", "025", "041"]
var username = 'miftachul.huda';
var password = 'asyncFunti0n11';

function checkDate() {
    var hours = moment().hours()
    if (hours < 8) {
        return "malam"
    } else if (hours < 16) {
        return "pagi"
    } else return "sore"
}


async function fire() {
    var getTokenLogin = async function () {
        var data = qs.stringify({
            'username': username,
            'password': password,
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
        return axios(config)
            .then(function (response) {
                console.log("Sucessfully Login to server".green)
                return response.data.token
            })
            .catch(function (error) {
                console.log('Failed to Login Something Wrong'.red);
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
        return axios(config)
            .then(function (response) {
                console.log("Sucessfully Get Last Value From Server".green)
                return response.data
            })
            .catch(function (error) {
                console.log('Failed to get Last Value Record'.red);
                runit()
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
        return axios(config)
            .then(function (response) {
                console.log("Sucessfully Get Schedule History From Server".green)
                return response.data
            })
            .catch(function (error) {
                console.log("Failed to Get Schedule History".red);
                runit()
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
            await cd()
            state = false
            return false;
        }
    }

    async function gettingReq() {
        lastvalue = await getLastValue(gettoken).then((v) => {
            return v
        })
            .catch(() => {
                console.log("Failed Get Last Value From Server. Trying to Get From Disk".bgYellow)
                return requireF('./lastvalue.json', "Last value not available in the Disk", gettingReq)
            })

        fs.writeFile('lastvalue.json', JSON.stringify(lastvalue))
        schedule = await getSchedule(gettoken).then((v) => {
            return v
        }).catch(() => {
            console.log("Failed Get Schedule From Server. Trying to Get From Disk".bgYellow)
            return requireF('./schedule.json', "Schedule not available in the Disk")
        })
        fs.writeFile('schedule.json', JSON.stringify(schedule))
    }
    await gettingReq()
    // switch (mode) {
    //     case 'skip':
    //         lastvalue = requireF('./lastvalue.json', "Last value not available please choose resync mode")
    //         schedule = requireF('./schedule.json', "Schedule not available please choose resync mode")
    //         break;
    //     case 'resync all':
    //         lastvalue = await getLastValue(gettoken)
    //         fs.writeFile('lastvalue.json', JSON.stringify(lastvalue)).then(function (response) {
    //             console.log("Sucessfully Save Last Value".green)
    //         })
    //             .catch(function (error) {
    //                 console.log("Failed Save Last Value".red);
    //             });
    //         schedule = await getSchedule(gettoken)
    //         fs.writeFile('schedule.json', JSON.stringify(schedule)).then(function (response) {
    //             console.log("Sucessfully Save Schedule".green)
    //         })
    //             .catch(function (error) {
    //                 console.log("Failed Save Schedule".red);
    //             });
    //         break;
    //     case 'resync last value':
    //         lastvalue = await getLastValue(gettoken)
    //         fs.writeFile('lastvalue.json', JSON.stringify(lastvalue)).then(function (response) {
    //             console.log("Sucessfully Save Last Value".green)
    //         })
    //             .catch(function (error) {
    //                 console.log("Failed Save Last Value".red);
    //             });
    //         schedule = requireF('./schedule.json', "Schedule not available please choose resync mode")
    //         break;
    //     case 'resync schedule':
    //         lastvalue = requireF('./lastvalue.json', "Last value not available please choose resync mode")
    //         schedule = await getSchedule(gettoken)
    //         fs.writeFile('schedule.json', JSON.stringify(schedule)).then(function (response) {
    //             console.log("Sucessfully Save Schedule".green)
    //         })
    //             .catch(function (error) {
    //                 console.log("Failed Save Schedule".red);
    //             });
    //         break;

    // }
    return [state, gettoken]
}
var filtering = async function (state, unit, waktu, scanner, synctime) {
    if (state) {
        var nowschedule = lodash(schedule).filter({ "unit": unit, "shift": waktu, "status": "Running" }).value()
        var filterchedule = nowschedule.filter(function (item) {
            if (item.equipment.substring(0, 4) == '041T' || item.equipment.substring(0, 4) == "TAPP") {
                return false
            } else
                return true;
        })
        var tosend = filterchedule.map(item => {

            synctime = moment(synctime)
            function addSecond(date, second) {
                return (date + (second * 1000))
            }
            var lastvaluefilter = lodash(lastvalue).filter({ "idEquipment": item.idEquipment }).value()
            var lastvaluefilterconcat = Object.keys(lastvaluefilter).reduce(function (arr, key) {
                return arr.concat(lastvaluefilter[key]);
            }, []);

            var addtoday = addSecond(synctime, 25)//(240-600)
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

    return [tosendconcat, filterchedule]
}

var syncronize = async function (tosend, token) {
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
    return axios(config)
        .then(function (response) {
            return response.data[0].Message
        })
        .catch(function (error) {
            s
            console.log(error);
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
    var resultdata = await filtering(state, unit, waktu, scanner, synctime)
    if (resultdata[1] != null && resultdata[0] != null) {
        await syncronize(resultdata[0], token).then(async (x) => {
            console.log(`Upload ${Object.keys(resultdata[1]).length} Equip Record Unit ${unit} jam ${waktu} date ${resultdata[0][resultdata[0].length - 1].timestamp.blue} user ${scanner} Messages : ${x.blue}`)
            await sendMessage(`<b>${scanner}</b> Unit <b>${unit}</b> ${Object.keys(resultdata[1]).length} Equip Record ${waktu} date ${resultdata[0][resultdata[0].length - 1].timestamp} :[${x}]`)
        }).catch(async () => {
            await syncronize(resultdata[0], token)
        })
    } else {
        console.log("Data not available".red)
        await sendMessage("No records available to send")
    }

}
var runit = async function () {
    async function asyncForEach(array, callback) {
        for (let index = 0; index < array.length; index++) {
            await callback(array[index], index, array);
        }
    }
    var date = moment().format("YYYY-MM-DD").toString();
    shift = checkDate()
    var statentoken = await fire()

    function radomize() {
        function randomInteger(min, max) {
            return Math.floor(Math.random() * (max - min + 1) + min)
        }
        random = randomInteger(720, 1800)
        return random
    }
    var waktuarr;
    var synctimearr;
    switch (shift) {
        case "malam":
            waktuarr = ["00:00", "04:00"]
            synctimearr = [moment(date + ' ' + "00:10:00").add(radomize(), 'seconds').format("YYYY-MM-DD HH:mm:ss").toString(), moment(date + ' ' + "04:00").add(radomize(), 'seconds').format("YYYY-MM-DD HH:mm:ss").toString()];
            break;
        case "pagi":
            waktuarr = ["08:00", "12:00"]
            synctimearr = [moment(date + ' ' + "08:10").add(radomize(), 'seconds').format("YYYY-MM-DD HH:mm:ss").toString(), moment(date + ' ' + "12:00").add(radomize(), 'seconds').format("YYYY-MM-DD HH:mm:ss").toString()];
            break;
        case "sore":
            waktuarr = ["16:00", "20:00"]
            synctimearr = [moment(date + ' ' + "16:10").add(radomize(), 'seconds').format("YYYY-MM-DD HH:mm:ss").toString(), moment(date + ' ' + "20:00").add(radomize(), 'seconds').format("YYYY-MM-DD HH:mm:ss").toString()];
            break;
    }
    await asyncForEach(unit, async (unit) => {
        var scanner;
        switch (unit) {
            case "021":
                scanner = scannerarr[0]
                break;
            case "022":
                scanner = scannerarr[0]
                break;
            case "023":
                scanner = scannerarr[1]
                break;
            case "024":
                scanner = scannerarr[2]
                break;
            case "025":
                scanner = scannerarr[0]
                break;
            case "041":
                scanner = scannerarr[1]
                break;
        }
        await asyncForEach(waktuarr, async (waktu, i) => {
            await uploadscene(statentoken[0], unit, waktu, scanner, synctimearr[i], statentoken[1]).catch(async () => {
                await uploadscene(statentoken[0], unit, waktu, scanner, synctimearr[i], statentoken[1])
            })
        })
    })
}
runit()
