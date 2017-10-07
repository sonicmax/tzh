// Original code by Milan

function Transloader() {
	const UPLOAD_SIZE_LIMIT = 10000000; // 10MB

	var threadZone = '';
	var needsRename = false;
	var imageSrcUrl = '';
	
	var imgurNotificationId;
	var threadZoneNotificationId;
	
	/** 'PUBLIC' METHODS **/
	
	/**
	 *  Set source URL using srcUrl property from context menu event
	 */
	 
	var setImage = function(srcUrl) {
		imageSrcUrl = srcUrl;		
	};
	
	/**
	 *  If set to true, displays prompt asking for new filename before upload
	 */
	
	var setParams = function(shouldRename) {
		if (shouldRename) {
			needsRename = true;
		}
	};
	
	/**
	 *  Set destination for upload.
	 */

	var setThreadZone = function(zone) {
		threadZone = zone;
	};
	
	/**
	 *  Main logic for transloader
	 */
	 
	var start = function() {
		if (hasCorrectParams()) {	
			var filename = getFilename(imageSrcUrl);
			
			if (needsRename) {
				var newFilename = handleRename(filename);
				if (newFilename === false) {
					return;
				}
				else if (newFilename) {
					filename = newFilename;
				}
			}
			
			fetchImage(imageSrcUrl, (filesize, mimetype, blob) => {
				if (filesize > UPLOAD_SIZE_LIMIT) {
					uploadToImgur(blob, filename);
				}
				
				else {
					uploadToThreadZone(blob, filename);
				}
				
			});	
		
		}	
	};
	
	/** 'PRIVATE' METHODS **/
	
	/**
	 *  Make sure that params were set correctly
	 */	
	
	var hasCorrectParams = function() {
		if (!imageSrcUrl || imageSrcUrl === '') {
			throw new Error('Couldn\'t find source URL');
		}
		
		else if (!threadZone || threadZone === '') {
			throw new Error('Couldn\'t find destination zone');
		}

		return true;
	};
	
	/**
	 *  Scrapes filename from URL and handles some weird edge cases
	 */
	
	var getFilename = function(url) {
		// Remove query parameters
		url = url.split('?')[0];
		
		var filename = url.substring(url.lastIndexOf('/') + 1);	
		
		// Make sure that filename isn't empty
		if (!filename) {
			filename = 'untitled.jpg';
		}
		
		// Facebook id fix
		if (/fbcdn\-sphotos/.test(url)) {
			filename = 'fb.jpg';
		}
		
		// We need to do some extra work to handle Wikia URLs
		if (/vignette[0-9].wikia.nocookie.net/.test(url)) {
		
			// We want to make sure that we transload the full size image
			if (/scale-to-width-down\/\d+/.test(url)) {
				var match = url.match(/scale-to-width-down\/\d+/)[0];
				url = url.replace(match, '');
			}
			
			// Wikia image URL paths can be weird (eg filename.jpg/revision/latest), so the filename is probably incorrect
			var splitUrl = url.split('/');
			for (var i = 0, len = splitUrl.length; i < len; i++) {
				var segment = splitUrl[i];
				if (/.(gif|jpg|png)/.test(segment)) {
					filename = segment;
					break;
				}
			}
		}
		
		// We have to trim .webp extension from wikiHow image URLs
		if (/whstatic.com\/images/.test(url)) {
			filename = filename.replace('.webp', '');		
		}
		
		return filename;
	};	
	
	/**
	 *  Allows user to specify new filename for image
	 */
	
	var handleRename = function(filename) {
		var extensionCheck = filename.match(/\.(gif|jpg|png)$/i);
			
		var originalExtension;
				
		if (extensionCheck) {
			originalExtension = extensionCheck[0];
			filename = filename.replace(originalExtension, '');
		}
		
		var newFilename = prompt('Enter new filename:', filename);
		
		if (newFilename === null) {
			// User pressed cancel. Return false to cancel upload
			return false;
		}
		
		else if (!/\S/.test(newFilename)) {
			// User entered blank filename, but presumably still wanted to upload something. Return null
			return;
		}
		
		else if (newFilename.match(/\.(gif|jpg|png)$/i)) {
			
			var newExtension = newFilename.match(/\.(gif|jpg|png)$/i)[0];
			
			// Make sure that new filename has correct extension			
			if (originalExtension && newExtension != originalExtension) {
				newFilename = newFilename.replace(newExtension, originalExtension);
			}

			return newFilename;	
		}
		
		else {
			// If originalExtension is undefined, we let Thread Zone handle the file extension.
			if (originalExtension) {
				return newFilename + originalExtension;
			}
			else {
				return newFilename;
			}
		}
	};
	
	/**
	 *  Fetches image from given URL and passes metadata and binary blob to callback
	 */
	
	var fetchImage = function(url, callback) {
		var fileGet = new XMLHttpRequest();
		fileGet.open('GET', url, true);
		fileGet.responseType = 'arraybuffer';
		
		fileGet.onload = () => {
			if (fileGet.status === 200) {
				// Get metadata
				var filesize = fileGet.getResponseHeader('Content-Length');
				var mimetype = fileGet.getResponseHeader('Content-Type');
				
				// Create blob
				var dataview = new DataView(fileGet.response);
				var blob = new Blob([dataview]);
				
				callback(filesize, mimetype, blob);
			} 
			
			else {
				throw new Error('Couldn\'t fetch image. Status code: ', xhr.statusText);
			}
		};
		
		fileGet.send();
	};

	/**
	 *  Uploads image to the Thread Zone
	 */
	
	var uploadToThreadZone = function(blob, filename) {
		var endpoint = 'https://' + threadZone + '.thread.zone/upload/image';
		// Construct FormData object containing image blob
		var formData = new FormData();
		formData.append('image', blob, filename);

		// Construct XHR and add event handlers/etc
		var xhr = new XMLHttpRequest();
		xhr.open('POST', endpoint, true);
		
		// After XHR completes, call onUploadSuccess with response and filename.
		// Throw error if status code indicates that an error occured
		
		xhr.onload = () => {
			
			if (xhr.status === 200) {
				chrome.notifications.clear(threadZoneNotificationId, null);
				onUploadSuccess(xhr.responseText, filename);
				
			} else {
				throw new Error('Couldn\'t upload image. Status code: ', xhr.statusText);
			}
		}	

		xhr.upload.addEventListener('progress', (evt) => {
			if (threadZoneNotificationId) {
				
				var update = {};
				
				if (evt.lengthComputable) {
					var percentage = Math.round((evt.loaded / evt.total) * 100);
					
					console.log(percentage);
					
					if (percentage === 100) {
						update.type = 'basic';
						update.contextMessage = 'Waiting for response...';
					}
					else {
						update.progress = percentage;
					}
					
					chrome.notifications.update(threadZoneNotificationId, update);
				}
			}	
		});				

		// Send FormData object to Thread Zone and create progress notification
		xhr.send(formData);
		showProgressNotification(xhr);
	};
	
	var showProgressNotification = function(xhr) {
		chrome.notifications.create('upload', {
			
			type: 'progress',
			title: 'Thread Zone Helper',
			message: 'Uploading image to the Thread Zone...',
			progress: 0,
			buttons: [{
				title: 'Cancel'
			}],
			requireInteraction: true,
			iconUrl: 'src/images/tiko_bird.png'
			
		}, (id) => {
			
			threadZoneNotificationId = id;
			
			chrome.notifications.onButtonClicked.addListener((notifId, btnIdx) => {
				
				if (notifId === id && btnIdx === 0) {
					xhr.abort();
					chrome.notifications.clear(id, null);
				}
				
			});
			
		});
	};	
	
	var onUploadSuccess = function(responseText, filename) {
		copyToClipboard(responseText);		
		showSuccessNotification(filename);
	};

	var uploadToImgur = function(blob, filename) {
		const IMGUR_UPLOAD_ENDPOINT = 'https://api.imgur.com/3/image';
		const API_KEY = 'Client-ID 6356976da2dad83';
		var formData = new FormData();
		formData.append('image', blob);
		
		var xhr = new XMLHttpRequest();
		xhr.open('POST', IMGUR_UPLOAD_ENDPOINT, true);
		xhr.setRequestHeader('Authorization', API_KEY);
		
		xhr.onload = () => {
			if (xhr.status === 200) {	
				var jsonResponse = JSON.parse(xhr.responseText);
				var url = jsonResponse.data.gifv;				
				onUploadSuccess(url, filename);
			}
			else {
				showErrorNotification(xhr.status);
			}
		};
		
		xhr.upload.addEventListener('progress', (evt) => {
			if (imgurNotificationId) {				
				var update = {};
				
				if (evt.lengthComputable) {
					var percentage = Math.round((evt.loaded / evt.total) * 100);
					
					if (percentage === '100%') {
						update.type = 'basic';
						update.contextMessage = 'Waiting for response...';
					}
					else {
						update.progress = percentage;
					}
					
					chrome.notifications.update(threadZoneNotificationId, update);
				}
			}	
		});
		
		showImgurNotification(xhr);
		
		xhr.send(formData);
	};

	var showImgurNotification = function(xhr) {
		chrome.notifications.create('fail', {
			
			type: 'progress',
			title: 'Too big to fail',
			message: 'This image is too big (>2MB) - uploading to Imgur...',
			progress: 0,
			buttons: [{
				title: 'Cancel'
			}],
			requireInteraction: true,
			iconUrl: 'src/images/tiko_bird_error.png'
			
		}, (id) => {
			
			imgurNotificationId = id;
			
			chrome.notifications.onButtonClicked.addListener((notifId, btnIdx) => {
				
				if (notifId === id && btnIdx === 0) {
					xhr.abort();
					chrome.notifications.clear(id, null);
				}
				
			});
			
		});
	};

	var showErrorNotification = function(statusCode) {
		chrome.notifications.create('fail', {
			
			type: 'basic',
			title: 'Image transloading failed',
			message: 'Error while uploading to Imgur. Status code: ' + statusCode,	
			iconUrl: 'src/images/tiko_bird_error.png'
			
		}, (id) => {
			
			setTimeout(() => {
				chrome.notifications.clear(id, null);	
			}, 3000);
			
		});
	};

	var copyToClipboard = function(text) {
		var clipboard = document.getElementById('clipboard');
		clipboard.value = text;
		clipboard.select();
		document.execCommand('copy');

		if (imgurNotificationId) {
			chrome.notifications.clear(imgurNotificationId, null);
			imgurNotificationId = null;
		}	
	};
	
	var showSuccessNotification = function(filename) {
		chrome.notifications.create('succeed', {
			
			type: 'basic',
			title: window.decodeURI(filename) + ' transloaded',
			message: 'The Markdown is now in your clipboard',
			iconUrl: 'src/images/tiko_bird.png'
			
		}, (id) => {
			
			setTimeout(() => {
				chrome.notifications.clear(id, null);	
			}, 5000);
			
		});
	};
	
	return {
		'setImage': setImage,
		'setParams': setParams,
		'setThreadZone': setThreadZone,
		'start': start		
	};
	
}