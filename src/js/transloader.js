"use strict";

// Original code by Milan, updated by sonicmax

/**  
 *  Fake class thing to handle image transloading.
 *  Usage: instantiate new Transloader, set image source URL with setImage(), then call start() to initiate transload
 */

function Transloader() {
	const UPLOAD_SIZE_LIMIT = 10000000; // 10MB
	const THREAD_ZONE_UPLOAD_MESSAGE = 'Uploading image to the Thread Zone...';
	const IMGUR_UPLOAD_MESSAGE = 'This image is too big (>10MB) - uploading to Imgur...';

	var needsRename = false;
	var imageSrcUrl = '';
	var notifier;
	
	var init = function() {
		notifier = new Notifier();
	}();
	
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
				var blob = new Blob([dataview], {type: mimetype});
				
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
		const ENDPOINT = 'https://thread.zone/api/upload';
		
		// Construct FormData object containing image blob
		var formData = new FormData();
		formData.append('image', blob, filename);

		// Construct XHR and add event handlers/etc
		var xhr = new XMLHttpRequest();
		xhr.open('POST', ENDPOINT, true);
		
		// After XHR completes, call onUploadSuccess with response and filename.
		// Throw error if status code indicates that an error occured
		
		xhr.onload = () => {
			
			if (xhr.status === 200) {
				notifier.clear();			
				onUploadSuccess(xhr.responseText, filename);
				
			} else {
				throw new Error('Couldn\'t upload image. Status code: ', xhr.statusText);
			}
		}	

		notifier.showProgress(THREAD_ZONE_UPLOAD_MESSAGE, xhr);
		xhr.upload.addEventListener('progress', notifier.updateProgress);
		xhr.send(formData);		
	};
	
	/**
	 *  Uploads image to Imgur
	 */
	
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
		
		notifier.showProgress(IMGUR_UPLOAD_MESSAGE, xhr);
		xhr.upload.addEventListener('progress', notifier.updateProgress);						
		xhr.send(formData);
	};		
	
	var onUploadSuccess = function(responseText, filename) {
		copyToClipboard(responseText);		
		showSuccessNotification(filename);
	};
	
	var copyToClipboard = function(text) {
		// Clipboard element is created by background.js
		var clipboard = document.getElementById('clipboard');
		clipboard.value = text;
		clipboard.select();
		document.execCommand('copy');
	};	
	
	var showSuccessNotification = function(filename) {		
		notifier.create('success', {	
			type: 'basic',
			title: window.decodeURI(filename) + ' transloaded',
			message: 'The Markdown is now in your clipboard',
			iconUrl: 'src/images/tiko_bird.png'			
		});
	};	

	var showErrorNotification = function(statusCode) {
		notifier.create('error', {
			type: 'basic',
			title: 'Image transloading failed',
			message: 'Error while uploading to Imgur. Status code: ' + statusCode,	
			iconUrl: 'src/images/tiko_bird_error.png'			
		});
	};
	
	return {
		'setImage': setImage,
		'setParams': setParams,
		'start': start		
	};
	
}