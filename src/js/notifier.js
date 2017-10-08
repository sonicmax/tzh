"use strict";

function Notifier() {
	const DEFAULT_TITLE = 'Thread Zone Helper';
	const DEFAULT_ICON_URL = 'src/images/tiko_bird.png';
	const ERROR_ICON_URL = 'src/images/tiko_bird_error.png';
	const CONFIG_KEY = 'TZH-Config';
	
	var notificationId;
	var allowMultipleNotifies = false;
	var duration;
	
	var init = function() {
		// Parse notification duration from config
		var config = JSON.parse(localStorage[CONFIG_KEY]);
		duration = parseInt(config.notificationDuration, 10) * 1000;
		
	}();
	
	/**
	 *  Creates notification using provided options and provided callback.
	 *  If no callback is provided, then default action is to clear notification
	 *  after required duration has passed
	 */
	 
	var create = function(id, options, callback) {
		if (duration === 0) {			
			return;
		}
		
		if (callback) {
			chrome.notifications.create(id, options, callback);	
		}
		
		else {		
			chrome.notifications.create(id, options, (currentId) => {
				
				setTimeout(() => {
					chrome.notifications.clear(currentId, null);	
				}, duration);
				
			});
		}
	};
	
	/**
	 *  Clears all currently displayed notifications.
	 */
	
	var clear = function() {
		chrome.notifications.clear(notificationId, null);
		chrome.notifications.clear(notificationId, null);
	};
	
	/**
	 *  Creates notification which shows current upload progress and allows user to cancel upload
	 */
	
	var showProgress = function(message, xhr) {
		chrome.notifications.create('progress', {
			
			type: 'progress',
			title: DEFAULT_TITLE,
			message: message || '',
			progress: 0,
			buttons: [{
				title: 'Cancel'
			}],
			requireInteraction: true,
			iconUrl: DEFAULT_ICON_URL
			
		}, (id) => {
			
			notificationId = id;
			
			chrome.notifications.onButtonClicked.addListener((notifId, btnIdx) => {
				
				if (notifId === id && btnIdx === 0) {
					xhr.abort();
					chrome.notifications.clear(id, null);
				}
				
			});
			
		});
	};
	
	/**
	 *  Updates current progress notification (or replaces with basic if action has completed)
	 */
	
	var updateProgress = function(evt) {
		if (notificationId) {
			
			var update = {};
			
			if (evt.lengthComputable) {
				var percentage = Math.round((evt.loaded / evt.total) * 100);
				
				if (percentage === 100) {
					update.type = 'basic';
					update.contextMessage = 'Waiting for response...';
				}
				else {
					update.progress = percentage;
				}
				
				chrome.notifications.update(notificationId, update);
			}
		}
	};	
	
	// Return public methods
	
	return {
		create: create,
		clear: clear,
		showProgress: showProgress,
		updateProgress: updateProgress
	};
}