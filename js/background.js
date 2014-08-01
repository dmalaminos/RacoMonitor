var currentStatus = null;
var showNotificationsConfig = true;
var soundNotificationsConfig = true;
var soundNotificacionsVolumeConfig = 1.0;
var saveSlot = null;
var firstTime = false;
var alarmPeriod = 1;
var flushCondition = false;
var canCheckUpdates = true;

/**
 * OAuth authorization
 * 
 */
var config = {
    consumerKey: "425170c5-1529-439b-bfae-e522ce316fe1",
    consumerSecret: "9d9eb9e3-003f-4c3f-ba14-43f52d0c107b",
    requestTokenUrl: "https://raco.fib.upc.edu/oauth/request_token",
    authorizationUrl: "https://raco.fib.upc.edu/oauth/protected/authorize",
    accessTokenUrl: "https://raco.fib.upc.edu/oauth/access_token"
};
 
var oauth = OAuth(config);
var oauthStatus = false;

if (localStorage.getItem('atk') && localStorage.getItem('ats')) {
    oauth.setAccessToken(localStorage.getItem('atk'), localStorage.getItem('ats'));
    oauthStatus = true;
} else {
    oAuthorize();
}

function oAuthorize() {
    oauth.fetchRequestToken(function(url) {
        console.log("Asking user...");
        var wnd = window.open(url, 'authorise');
        setTimeout(waitForAuth, 100);
        
        function waitForAuth() {
            if (wnd.closed) {
                oauth.fetchAccessToken(function(data) {
                    var accessTokenKey = oauth.getAccessTokenKey();
                    var accessTokenSecret = oauth.getAccessTokenSecret();
                    localStorage.setItem('atk', accessTokenKey);
                    localStorage.setItem('ats', accessTokenSecret);
                    saveReaderStatus("ok");
                    console.log('Now authorised for 3-legged requests');
                    oauthStatus = true;
                }, function(data) {
                    console.error("Cannot authorize");
                    oauthStatus = false;
                });
            } else {
                setTimeout(waitForAuth, 100);
            }
        }
    }, function(data) {
        console.error("Cannot authorize");
        oauthStatus = false;
    });
}

/**
 * Data structures 
 * 
 */
function CourseList() {
    this.courseList = [];
    this.addItem = function(it) {
        for (var i = 0; i < this.courseList.length; ++i) {
            if (this.courseList[i].name === it.parentC) {
                this.courseList[i].addItem(it);
                return;
            }
        }
        var c = new Course();
        c.name = it.parentC;
        c.addItem(it);
        this.courseList.push(c);
    };
    this.getCourseIndex = function(cname) {
        for (var i = 0; i < this.courseList.length; ++i) {
            if (this.courseList[i].name === cname) return i;
        }
    };
    this.nCourse = function() {
        return this.courseList.length;
    };
    this.getCourseByPos = function(i) {
        return this.courseList[i];
    };
    this.getCourseByName = function(name) {
        for (var i = 0; i < this.courseList.length; ++i) {
            if (this.courseList[i].name === name) return this.courseList[i];
        }
        return null;
    };
    this.parseData = function(strData) {
        var nUr = 0;
        var courses = strData.split("<course ");
        for (var i = 0; i < courses.length-1; ++i) {
            var c = new Course();
            var name = courses[i+1].substring(0, courses[i+1].indexOf(">"));
            c.name = name;
            var items = courses[i+1].split("<item>");
            for (var j = 0; j < items.length-1; ++j) {
                var itTitle = items[j+1].split("<title>")[1];
                var itLink = items[j+1].split("<link>")[1]; 
                var itDescription = items[j+1].split("<description>")[1];
                var itPubDate = items[j+1].split("<pubDate>")[1];
                var itSeen = (items[j+1].split("<seen>")[1] === "true");
                var itId = items[j+1].split("<id>")[1];
                if (!itSeen) ++nUr;

                var it = new FeedItem(name, itTitle, itLink, itDescription, itPubDate, itSeen);
                it.id = itId;
                c.addItem(it);
            }
            this.courseList.push(c);
        }
        refreshBadge(nUr);
    };
    this.stringifyData = function() {
        var nUr = 0;
        var strData = "<courselist>";
        for (var i = 0; i < this.nCourse(); ++i) {
            var c = this.getCourseByPos(i);
            strData += "<course "+c.name+">";
            for (var j = 0; j < c.nItems(); ++j) {
                var it = c.getItemByPos(j);
                strData += "<item>";
                strData += "<title>"+it.title+"<title>";
                strData += "<link>"+it.link+"<link>";
                strData += "<description>"+it.description+"<description>";
                strData += "<pubDate>"+it.pubDate+"<pubDate>";
                strData += "<seen>"+it.seen+"<seen></item>";
                strData += "<id>"+it.id+"<id></item>";
                if (!it.seen) ++nUr;
            }
            strData += "</course>";
        }
        strData += "</courselist>";
        refreshBadge(nUr);
        return strData;
    };
    this.hasItem = function(it) {
        for (var i = 0; i < this.courseList.length; ++i) {
            if ((this.courseList[i]).hasItem(it)) return true;
        }
        return false;
    };
    this.hasCourse = function(cname) {
        for (var i = 0; i < this.courseList.length; ++i) {
            if (this.courseList[i].name === cname) return true;
        }
        return false;
    };
}

function Course() {
    this.name = "";
    this.items = [];
    this.addItem = function(i) {
        this.items.push(i);
    };
    this.hasItem = function(it) {
        for (var i = 0; i < this.items.length; ++i) {
            if (equalItems(it, this.items[i])) return true;
        }
        return false;
    };
    this.getItemByPos = function(i) {
        return this.items[i];
    };
    this.nItems = function() {
        return this.items.length;
    };
    this.nUnseenItems = function() {
        var count = 0;
        for (var i = 0; i < this.items.length; ++i) {
            if (!this.items[i].seen) ++count;
        }
        return count;
    };
}

function FeedItem(c, t, l, d, p, s) {
    this.parentC = c;
    this.title = t;
    this.link = l;
    this.description = d;
    this.pubDate = p;
    this.seen = s;
    this.id = 0;
}

function equalItems(it1, it2) {
    var v1 = (it1.parentC === it2.parentC);
    var v2 = (it1.title === it2.title);
    var v3 = (it1.link === it2.link);
    var v4 = (it1.description === it2.description);
    var v5 = (it1.pubDate === it2.pubDate);
    return (v1 && v2 && v3 && v4 && v5);
}

function existsItem(it) {
    for (var i = 0; i < currentStatus.nCourse(); ++i) {
        var c = currentStatus.getCourseByPos(i);
        for (var j = 0; j < c.nItems(); ++j) {
            if (equalItems(c.getItemByPos(j), it)) return true;
        }
    }
    return false;
}


/**
 * Persistence and popup interaction
 * 
 */
function refreshAndLoad() {
    flushCondition = false;
    checkFeedNow();
    loadStatus();
    currentStatus = null;
}

function updateAlarmPeriod() {
    chrome.alarms.clearAll();
    chrome.alarms.create('racoAlarm', {
        periodInMinutes : alarmPeriod
    });
}

function loadStatus() {
    var controlPort = chrome.runtime.connect({name: "control"});
    if (localStorage.getItem('racoStatus')) {
        var strData = localStorage.getItem('racoStatus');
        controlPort.postMessage({code: "loadedstatus", content: strData});
        console.log("Status loaded, sending for restoration...");
    } else {
        controlPort.postMessage({code: "emptystatus", content: ""});
        console.log("No status previously saved found");
    }
}

function loadLocalStatus() {
    if (localStorage.getItem('racoStatus')) {
        var strData = localStorage.getItem('racoStatus');
        currentStatus.parseData(strData);
    } else currentStatus = new CourseList();
}

function saveStatus() {
    localStorage.setItem('racoStatus', saveSlot);
    saveSlot = null;
    console.log("Status saved");
}

function clearStorageData() {
    localStorage.clear();
    firstTime = true;
    return;
}

function saveReaderStatus(status) {
    localStorage.setItem('readerStatus', status);
}


/**
 * Notifications and badge management
 * 
 */
function refreshBadge(n) {
    if (n === 0) chrome.browserAction.setBadgeText({text: ""});
    else chrome.browserAction.setBadgeText({text: n.toString()});
}

function getNotifConfig() {
    if (localStorage.getItem('desktopNotf')) {
        if (localStorage.getItem('desktopNotf') === "en") {
            showNotificationsConfig = true;
        } else showNotificationsConfig = false;
    } else {
        showNotificationsConfig = true;
        localStorage.setItem('desktopNotf', "en");
    }
}

function minTitle(title) {
    if (title.length > 47) {
        var sTitle = title.substring(0, 47);
        return sTitle.concat("...");
    } else return title;
}

function showNotification(notContent) {
    chrome.notifications.create('RacoMonitor-notif', {   
        type: 'list', 
        iconUrl: 'fibicon_1_48x48x32.png', 
        title: notContent.title, 
        message: notContent.message
    }, function() {
        console.log("Notification dispatched");
        setTimeout(function() {
            chrome.notifications.clear("RacoMonitor-notif", function (wasCleared) {});
        }, 10000);
    });
}

function generateNotContent(items) {
    var countList = [];
    var courseNameList = [];
    for (var i = 0; i < items.length; ++i) {
        var n = courseNameList.indexOf(items[i].parentC);
        if (n === -1) {
            courseNameList.push(items[i].parentC);
            countList.push(1);
        } else ++countList[n];
    }

    var notMessage;
    if (!localStorage.getItem('lang')) localStorage.setItem('lang', "cast");
    if (localStorage.getItem('lang') === "cast") {
        if (countList[0] === 1) notMessage = "Se ha publicado ";
        else notMessage = "Se han publicado ";
    } else {
        if (countList[0] === 1) notMessage = "S'ha publicat ";
        else notMessage = "S'han publicat ";
    }
    for (var i = 0; i < courseNameList.length; ++i) {
        if (i !== 0) {
            if (i === courseNameList.length-1 && courseNameList.length > 1) {
                if (localStorage.getItem('lang') === "cast") notMessage += " y ";
                else notMessage += " i ";
            } else if (i !== courseNameList.length-1) notMessage += ", ";
        }
        notMessage += countList[i];
        if (localStorage.getItem('lang') === "cast") {
            if (countList[i] === 1) notMessage += " aviso";
            else notMessage += " avisos";
        } else {
            if (countList[i] === 1) notMessage += " avís";
            else notMessage += " avisos";
        }
        notMessage += " de "+courseNameList[i];  
    }
    var notTitle;
    if (localStorage.getItem('lang') === "cast") {
        if (items.length === 1) notTitle = "Nuevo aviso publicado";
        else notTitle = "Nuevos avisos publicados";
    } else {
        if (items.length === 1) notTitle = "Nou avís publicat";
        else notTitle = "Nous avisos publicats";
    }
    return {title: notTitle, message: notMessage};
}


/**
 * Feed and content handling
 * 
 */
function getFeed() {
    var options = {
        method: 'POST',
        url: 'https://raco.fib.upc.edu/api-v1/avisos.rss',
        success: readFeed,
        failure: feedError,
        headers: {
            'Content-Type': 'application/xml'
        }
    };
    oauth.request(options);
}

function parseCourseName(rawtitle) {
    var n = rawtitle.indexOf(" ");
    return rawtitle.substring(0,n);
}

function parseItemTitle(rawtitle) {
    var n = rawtitle.indexOf(" ");
    return rawtitle.substring(n+3,rawtitle.length-3);
}

function parseItemLinkDesc(rawlink) {
    rawlink = rawlink.replace("<![CDATA[","");
    return rawlink.substring(0,rawlink.length-3);
}

function readFeed(data) {
    var readItems = [];
    var parser = new DOMParser();
    //debería de ser data.text.toString...
    var xmlDoc = parser.parseFromString(data.toString(), "text/xml");
    //console.log(xmlDoc);
    
    var feedNodeList = xmlDoc.getElementsByTagName("item");
    saveReaderStatus("ok");
    for (var i = 0; i < feedNodeList.length; i++) {
        var str = (feedNodeList[i].getElementsByTagName("title")[0].innerHTML).replace("<![CDATA[","");
        var name = parseCourseName(str);
        var title = parseItemTitle(str);
        var link = parseItemLinkDesc(feedNodeList[i].getElementsByTagName("link")[0].innerHTML);
        var description = parseItemLinkDesc(feedNodeList[i].getElementsByTagName("description")[0].innerHTML);
        var pubDate = feedNodeList[i].getElementsByTagName("pubDate")[0].innerHTML;

        var it = new FeedItem(name, title, link, description, pubDate, firstTime);
        readItems.push(it);
    }
    console.log(readItems.length+" items read");
    validateItems(readItems, flushCondition);
    if (firstTime) firstTime = false;
    if (flushCondition) currentStatus = null;
}

function feedError() {
    console.error("Cannot read newsfeed");
    saveReaderStatus("bad");
}

function getLastId() {
    var li;
    if (localStorage.getItem('lastIdentifier')) {
        li = parseInt(localStorage.getItem('lastIdentifier'));
    } else li = 1;
    var nli = li+1;
    localStorage.setItem('lastIdentifier', nli);
    return li;
}

function diff(readItems) {
    var newItems = [];
    for (var i = 0; i < readItems.length; ++i) {
        if (!currentStatus.hasCourse(readItems[i].parentC)) newItems.push(readItems[i]);
        else if (!existsItem(readItems[i])) newItems.push(readItems[i]);
    }
    return newItems;
}

function validateItems(readItems, sendNews) {
    currentStatus = new CourseList();
    loadLocalStatus();
    var newItems = diff(readItems);
    
    if (newItems.length > 0) {
        console.log(newItems.length+" new items found");
        for (var i = 0; i < newItems.length; ++i) {
            var it = newItems[i];
            it.id = getLastId();
            currentStatus.addItem(it);
        }
        /*DMA*/
        var strData = currentStatus.stringifyData();
        saveSlot = strData;
        saveStatus();
        if (sendNews) {
            var controlPort = chrome.runtime.connect({name: "control"});
            controlPort.postMessage({code: "livenewsfeed"});
        }
        
        if (!firstTime) {
            if (showNotificationsConfig) {
                var notContent = generateNotContent(newItems);
                showNotification(notContent);
            } 
            if (soundNotificationsConfig) {
                var audio = new Audio('sounds/alarm.mp3');
                audio.volume = soundNotificacionsVolumeConfig;
                audio.play();
            }
        }   
    }
    if (sendNews) currentStatus = null;
}

function checkFeedNow() {
    console.log("Checking news @ "+moment().format('MMMM Do YYYY, h:mm:ss a'));
    getFeed();
}


/**
 * Event listeners
 * 
 */
chrome.runtime.onStartup.addListener(function () {
    console.log("STARTUP");
    
    if (oauthStatus) {
        flushCondition = false;
        checkFeedNow();
    }
    chrome.alarms.create('racoAlarm', {
        periodInMinutes : alarmPeriod
    });
    chrome.alarms.create('checkUpdate', {
        periodInMinutes : 480.0
    });
});

chrome.runtime.onInstalled.addListener(function(){
    console.log("INSTALLED");
    firstTime = true;
    if (oauthStatus) {
        flushCondition = false;
        checkFeedNow();
    }
    chrome.alarms.create('racoAlarm', {
        periodInMinutes : alarmPeriod
    });
    chrome.alarms.create('checkUpdate', {
        periodInMinutes : 480.0
    });
});

chrome.alarms.onAlarm.addListener(function (alrm) {
    if (alrm.name === 'racoAlarm') {
        if (oauthStatus) {
            flushCondition = true;
            checkFeedNow();
        }
    } else if (alrm.name === 'checkUpdate') {
        console.log("Enabling update check @ "+moment().format('MMMM Do YYYY, h:mm:ss a'));
        canCheckUpdates = true;
    }
});

//r
//ö
//g
//b
//ő
//l
//
//é
//l
//e
//t
