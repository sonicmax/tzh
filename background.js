var background = (() => {
	var config = {};
	var tabPorts = {};
	
	var init = function(defaultConfig) {
		updateConfig(defaultConfig);
		buildContextMenu();	
		messagePassing.addListeners();
		chrome.notifications.onClicked.addListener(makeNotificationOriginActive);
		checkVersion();
		createClipboardElement();	
	};
	
	var getDefaultConfig = function(callback) {
		var defaultURL = chrome.extension.getURL('/src/json/defaultconfig.json');
		var xhr = new XMLHttpRequest();
		xhr.open("GET", defaultURL, true);
		xhr.onload = function() {
			if (this.status == 200) {
				callback(JSON.parse(this.responseText));
			}
		};
		xhr.send();
	};
	
	var updateConfig = function(defaultConfig) {
		if (localStorage['TZH-Config'] === undefined) {
			localStorage['TZH-Config'] = JSON.stringify(defaultConfig);
			config = defaultConfig;
		}
		
		else {
			config = JSON.parse(localStorage['TZH-Config']);
			
			for (var i in defaultConfig) {
				// if this variable does not exist, set it to the default
				if (config[i] === undefined) {
					config[i] = defaultConfig[i];
				}
			}		
		}
	};
	
	var checkVersion = function() {
		var app = chrome.app.getDetails();
		// notify user if chromeLL has been updated
		if (localStorage['TZH-Version'] != app.version 
				&& localStorage['TZH-Version'] != undefined 
				&& config.systemNotifications) {
					
			chrome.notifications.create('popup', {
				
					type: "basic",
					title: "TZH has been updated",
					message: "Old v: " + localStorage['TZH-Version'] 
							+ ", New v: " + app.version,
					buttons: [{
						title: "Click for more info",
					}],
					iconUrl: "src/images/tiko_bird.png"
					
				}, (id) => {
					
					chrome.notifications.onButtonClicked.addListener((notifId, btnIdx) => {
						
						if (notifId === id && btnIdx === 0) {
							// link user to topic containing changelog and other info
							window.open("http://boards.endoftheinter.net/showmessages.php?topic=9458231");
							chrome.notifications.clear(id, null);
						}
						
					});
					
					setTimeout(function() {
						chrome.notifications.clear(id, null);
					}, 5000);
				}
			);
			
			localStorage['TZH-Version'] = app.version;
		}

		if (localStorage['TZH-Version'] == undefined) {
			localStorage['TZH-Version'] = app.version;
		}
	};
	
	var checkSync = function() {
		chrome.storage.sync.get('config', function(syncData) {
			
			if (syncData.config && syncData.config.lastSave > config.lastSave) {		
				// synced config file is more recent than version on computer
				for (var keyName in syncData.config) {					
					config[keyName] = syncData.config[keyName];					
				}
				
				localStorage['TZH-Config'] = JSON.stringify(config);
				
				var bSplit = [];
				
				for (var k in split) {
					if (config[split[k]]) {
						bSplit.push(k);
					}
				}
				
				chrome.storage.sync.get(bSplit, function(syncConfig) {
					for (var l in syncConfig) {
						config[l] = syncConfig[l];
					}
					localStorage['TZH-Config'] = JSON.stringify(config);
				});
				
			}
			
			else if (!syncData.config || syncData.config.lastSave < config.lastSave) {
				var localConfig = JSON.parse(localStorage['TZH-Config']);
				var toSet = {};
				for (var i in split) {
					if (config[split[i]]) {
						toSet[i] = localConfig[i];
					}
					delete localConfig[i];
				}
				toSet.config = localConfig;
				for (var i in toSet) {
					var f = function(v) {
						chrome.storage.sync.getBytesInUse(v, function(use) {
							// chrome.storage api allows 8,192 bytes per item
							if (use > 8192) {
								var sp = Math.ceil(use / 8192);
								var c = 0;
								for (var j in toSet[v]) {
									if (!toSet[v + (c % sp)]) {
										toSet[v + (c % sp)] = {};
									}
									toSet[v + (c % sp)][j] = toSet[v][j];
									c++;
								}
								delete toSet[v];
							}
						});
					}
					f(i);
				}
				chrome.storage.sync.set(toSet);				
			}
		});
	};
	
	var createClipboardElement = function() {
		var backgroundPage = chrome.extension.getBackgroundPage();
		var textArea = backgroundPage.document.createElement("textarea");
		textArea.id = "clipboard";
		backgroundPage.document.body.appendChild(textArea);	
	};
	
	var buildContextMenu = function() {
		chrome.contextMenus.create({
			"title": "Transload image to the Thread Zone",
			"onclick": (info)  => {
				transloadImage(info);
			},
			"contexts": ["image"]
		});
		
		if (config.enableImageRename) {
			// Note: we don't really need to specify site here because extensions with multiple context menu items 
			// are grouped together under extension name.
			
			chrome.contextMenus.create({
				"title": "Rename and transload image",
				"onclick": (info) => {
					transloadImage(info, true);
				},
				"contexts": ["image"]
			});
		}
	};
	
	var transloadImage = function(info, shouldRename) {
		var transloader = new Transloader();
		transloader.setImage(info.srcUrl);
		transloader.setParams(shouldRename);
		transloader.start();
	};
	
	var notificationData = {};
	
	/** 
	 *  After notification onclick fires, get the stored window/tab id from
	 *  notificationData and focus the window/make the tab active.
	 */
	 
	var makeNotificationOriginActive = function(notificationId) {
		if (!notificationData[notificationId]) {
			return;
		}
		
		var originatingTab = notificationData[notificationId].tab;
		
		chrome.windows.update(originatingTab.windowId, { focused: true }, () => {
			
			chrome.tabs.update(originatingTab.id, { active: true }, () => {
			
				chrome.notifications.clear(notificationId, () => {
					delete notificationData[notificationId];
				});
				
			});
		});			
	};
	
	
	/**
	 *  Handles message passing between content scripts and background page
	 */
	
	var messagePassing = {
		addListeners: function() {
			// Add listener to handle incoming connections
			chrome.runtime.onConnect.addListener(messagePassing.connectToTab);
			
			// Handle incoming messages
			chrome.runtime.onMessage.addListener(messagePassing.handleMessage);
			
			// Update badge with ignorator info for active tab
			chrome.tabs.onActivated.addListener(messagePassing.updateActiveTab);
			
			// Delete references to tab after navigating away from ETI
			chrome.tabs.onUpdated.addListener(messagePassing.checkNavigationDest);		
			
			// Delete references to tab after closing
			chrome.tabs.onRemoved.addListener(messagePassing.deleteTabRefs);						
		},
		
		connectToTab: function(port) {
			background.tabPorts[port.sender.tab.id] = {};
			background.tabPorts[port.sender.tab.id] = port;
			
			background.tabPorts[port.sender.tab.id].onMessage.addListener((msg) => {
				background.ignoratorUpdate.call(background, port.sender.tab.id, msg);
			});
		},
		
		updateActiveTab: function(tab) {
			if (background.tabPorts[tab.tabId]) {
				
				try {					
					background.tabPorts[tab.tabId].postMessage({
						action: 'ignorator_update'
					});
				
				} catch(e) {
					// Attempting to use a disconnected port object - remove any references to this tab
					messagePassing.deleteTabRefs(tab.tabId);
				}
			}
		},
		
		checkNavigationDest: function(tabId, changeInfo) {
			var newUrl = changeInfo.url;
			if (newUrl && newUrl.indexOf('endoftheinter.net') === -1) {
				messagePassing.deleteTabRefs(tabId);
			}			
		},
		
		deleteTabRefs: function(tabId) {
			if (background.tabPorts[tabId]) {
				delete tabPorts[tabId];
				delete ignoratorInfo[tabId];
				delete scopeInfo[tabId];
			}	
		},
		
		handleMessage: function(request, sender, sendResponse) {
			switch(request.need) {
				
				case "xhr":
					ajax(request, sendResponse);
					// Return true so that we can use sendResponse asynchronously 
					// (See: https://developer.chrome.com/extensions/runtime#event-onMessage)
					return true;
					
				case "notify":
					// Generate unique ID for each tab so we can perform tab-specific actions later
					createNotification(request, sender);					
					break;				
					
				case "progress_notify":
					progressNotification.create(request.data);
					break;
					
				case "update_progress_notify":
					progressNotification.update(request.update);
					break;
					
				case "clear_progress_notify":
					progressNotification.clear(request.title);
					break;

				case "copy":
					var clipboard = document.getElementById('clipboard');
					clipboard.value = request.data;
					clipboard.select();
					document.execCommand("copy");
					break;
					
				case "options":
					chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
							// check whether bg script can send messages to current tab
							if (tabPorts[tabs[0].id] && !config.openOptionsInNewTab) {
								// Open options page in iframe
								chrome.tabs.sendMessage(tabs[0].id, {
									action: "showOptions"
								}, null);
							}
							
							else {
								// Create new tab
								chrome.runtime.openOptionsPage();						
							}					
					});
					
					break;
					
				default:
					console.log("Error in request listener - undefined parameter?", request);
					break;
			}
		}
	};
	
	var createNotification = function(request, sender) {
		var id = "notify_" + sender.tab.id;
		
		notificationData[id] = {
			tab: sender.tab
		};
		
		chrome.notifications.create(id, {
			type: "basic",
			title: request.title,
			message: request.message,
			iconUrl: "src/images/tiko_bird.png"
		},
		
		(id) => {
			
			if (config.notificationDuration === "0") {
				return;
			}
			
			setTimeout(() => {
				chrome.notifications.clear(id, null);
				delete notificationData[id];
			}, parseInt(config.notificationDuration, 10) * 1000);
			
		});
	};
	
	var progressNotification = () => {
		
		var create = function(data) {
			chrome.notifications.create('progress', {
				
				type: 'progress',
				title: data.title,
				message: '',
				progress: data.progress,						
				requireInteraction: true,
				iconUrl: 'src/images/lueshi_48.png'
				
			});
		};
		
		var update = function(update) {
			chrome.notifications.update('progress', update);
		};
		
		var clear = function(title) {
			chrome.notifications.update('progress', { type: 'basic', title: title, contextMessage: '' });
			
			setTimeout(() => {
				chrome.notifications.clear('progress', null);
			}, 3000);		
		};
		
		return {
			'create': create,
			'update': update,
			'clear': clear			
		};		
	};
	
	return {
		'init': init,
		'getDefaultConfig': getDefaultConfig
	};
	
})();
	
background.getDefaultConfig((config) => {
	background.init(config);
});