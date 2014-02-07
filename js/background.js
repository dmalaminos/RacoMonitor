var currentStatus = null;
var nUnreadItems = 0;
var showNotificationsConfig = true;
var saveSlot = null;
var firstTime = false;


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

function refreshBadge(n) {
    if (n === 0) chrome.browserAction.setBadgeText({text: ""});
    else chrome.browserAction.setBadgeText({text: n.toString()});
}

function refreshAndLoad() {
    checkFeedNow(false);
    loadStatus();
    currentStatus = null;
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

//BACKGROUND!

function getFeed(addr) {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", addr, false);
    xhr.send();
    return xhr.responseXML;
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

function whatsup() {
    var readItems = [];
    
    var docXML = getFeed("rss_avisos.jsp");
    var feedNodeList = docXML.getElementsByTagName("item");
    
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
    return readItems;
}

//r
//e
//g
//ő
//
//r
//e
//j
//t
//e
//m

function getNUnreadItems() {
    var nItems = 0;
    for (var i = 0; i < currentStatus.nCourse(); ++i) {
        var c = currentStatus.getCourseByPos(i);
        for (var j = 0; i < c.nItems(); ++j) {
            if (!c.getItemByPos(j).seen) ++nItems;
        }
    }
    return nItems;
}

var alarmPeriod = 1;

function updateAlarmPeriod() {
    //console.log("Changing alarm period to "+alarmPeriod);
    chrome.alarms.clearAll();
    chrome.alarms.create('racoAlarm', {
        periodInMinutes : alarmPeriod
    });
}

chrome.runtime.onStartup.addListener(function () {
    //Cuando se inicia el navegador, comprobado
    console.log("STARTUP");
    checkFeedNow(false);
    chrome.alarms.create('racoAlarm', {
        periodInMinutes : alarmPeriod
    });
});

chrome.runtime.onInstalled.addListener(function(){
    //Cuando se instala la extensión
    console.log("INSTALLED");
    firstTime = true;////////////////////////////////////////////////////////////////////////////////
    //currentStatus = new CourseList();
    //loadLocalStatus();
    checkFeedNow(false);
    chrome.alarms.create('racoAlarm', {
        periodInMinutes : alarmPeriod
    });
});

function clearStorageData() {
    localStorage.clear();
    firstTime = true;
    return;
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

function damelo() {
    for (var i = 0; i < currentStatus.nCourse(); ++i) {
        var name = currentStatus.getCourseByPos(i).name;
        console.log(name+" : "+currentStatus.getCourseByName(name).nItems());
    }
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
        var strData = currentStatus.stringifyData();
        saveSlot = strData;
        saveStatus();
        if (sendNews) {
            var controlPort = chrome.runtime.connect({name: "control"});
            controlPort.postMessage({code: "livenewsfeed"});
        }
        
        if (!firstTime && showNotificationsConfig) {
            var notContent = generateNotContent(newItems);
            showNotification(notContent);
        }
    }
    if (sendNews) currentStatus = null;
}

function checkFeedNow(flush) {
    console.log("Checking news "+moment().format('MMMM Do YYYY, h:mm:ss a'));
    var readItems = whatsup();
    console.log(readItems.length+" items read");
    validateItems(readItems, flush);
    if (firstTime) firstTime = false;
    if (flush) currentStatus = null;
}

chrome.alarms.onAlarm.addListener(function (alrm) {
    checkFeedNow(true);
});

function minTitle(title) {
    if (title.length > 47) {
        var sTitle = title.substring(0, 47);
        return sTitle.concat("...");
    } else return title;
}

function showNotification(notContent) {
    chrome.notifications.create('RacoMonitor-notif', {   
        type: 'list', 
        iconUrl: 'icon.png', 
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
    if (countList[0] === 1) notMessage = "Se ha publicado ";
    else notMessage = "Se han publicado ";
    for (var i = 0; i < courseNameList.length; ++i) {
        if (i !== 0) {
            if (i === items.length-2 && items.length > 1) notMessage += " y ";
            else if (i !== items.length-1) notMessage += ", ";
        }
        notMessage += countList[i];
        if (countList[i] === 1) notMessage += " aviso";
        else notMessage += " avisos";
        notMessage += " de "+courseNameList[i];  
    }
    var notTitle;
    if (items.length === 1) notTitle = "Nuevo aviso publicado";
    else notTitle = "Nuevos avisos publicados";
    return {title: notTitle, message: notMessage};
}


