$(document).ready(() => {
	
	// Some jQuery to handle menu navigation and stuff
	
	$('.options_navigation_link').click(function() {
		
		var toLink = $(this)
				.attr('id')
				.split('_link')[0];

		var selectedPage = $('.navbar-item-selected')
				.attr("id")
				.split('_link')[0];

		if (toLink == selectedPage) {
			return true;
		}

		$('#' + selectedPage + '_link')
				.removeClass("navbar-item-selected");
				
		$('#' + toLink + '_link')
				.addClass("navbar-item-selected");

		$('#' + selectedPage + '_page')
				.removeClass("shown")
				.addClass("hidden");
				
		$('#' + toLink + '_page')
					.removeClass("hidden")
					.addClass("shown");

		$('body').css("background-color", "transparent");		
	});
	
	options.init();
	
});

var options = {
	init: function() {
		var config = JSON.parse(localStorage['TZH-Config']);
		
		// Populate page with data from config		
		var checkboxes = $(":checkbox");
		for ( var i in checkboxes) {
			checkboxes[i].checked = config[checkboxes[i].id];
		}
		
		var textboxes = $(":text");
		for (var i in textboxes) {
			if (config[textboxes[i].id]) {
				textboxes[i].value = config[textboxes[i].id];
			}
		}
		
		// Populate some other fields and set up download link for config
		document.getElementById('notificationDuration').value = config.notificationDuration;
		document.getElementById('version').innerText = chrome.app.getDetails().version;
		document.getElementById('downloadcfg').href = options.download();
		
		if (document.readyState == 'loading') {
			
			document.addEventListener('DOMContentLoaded', () => {
				
				options.addListeners.click();
				options.addListeners.keyup();
				options.addListeners.change();

				options.save();
			});
		} 
		
		else {
			options.addListeners.click();
			options.addListeners.keyup();
			options.addListeners.change();

			options.save();
		}		
	},
	
	utils: {
		downloadClick: function() {
			document.getElementById('downloadcfg').click();
		},
		
		restoreClick: function() {
			document.getElementById('restorecfg').click();
		},	
		
		showTextarea: function() {
			document.getElementById('old_cfg_options').style.display = "none";
			document.getElementsByClassName('old_cfg_options')[0].style.display = "inline";			
			options.show();
		},	
		
		processConfig: function(textfile) {
			var base64;
			try {
				if (typeof textfile === 'string') {
					newCfg = JSON.parse(textfile);
				}
				else if (document.getElementById('cfg_ta').value != '') {
					newCfg = JSON.parse(document.getElementById('cfg_ta').value);
				}		
				var myCfg = JSON.parse(localStorage['TZH-Config']);
				for (var i in newCfg) {
					myCfg[i] = newCfg[i];				
				}
				myCfg.last_saved = new Date().getTime();
				localStorage['TZH-Config'] = JSON.stringify(myCfg);
			} catch (e) {
				console.log('This doesnt look like a config', e);
				base64 = options.utils.decodeBase64(document.getElementById('cfg_ta').value);
				options.restoreV1(base64);
			}
			location.reload();
		},	
		
		resetConfig: function() {
			$.confirm({
					text: "Are you sure you want to reset your settings?",
					
					confirm: () => {					
						options.getDefault(function(defaultCfg) {
							localStorage['TZH-Config'] = defaultCfg;
							location.reload();
						});					
					},
					
					cancel: () => {
						return;
					}
			});
		},	
		
		decodeBase64: function() {
			var Base64 = {
				_keyStr: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",
				decode: function(input) {
					var output = "";
					var chr1, chr2, chr3;
					var enc1, enc2, enc3, enc4;
					var i = 0;

					input = input.replace(/[^A-Za-z0-9\+\/\=]/g, "");

					while (i < input.length) {

						enc1 = this._keyStr.indexOf(input.charAt(i++));
						enc2 = this._keyStr.indexOf(input.charAt(i++));
						enc3 = this._keyStr.indexOf(input.charAt(i++));
						enc4 = this._keyStr.indexOf(input.charAt(i++));

						chr1 = (enc1 << 2) | (enc2 >> 4);
						chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
						chr3 = ((enc3 & 3) << 6) | enc4;

						output = output + String.fromCharCode(chr1);

						if (enc3 != 64) {
							output = output + String.fromCharCode(chr2);
						}
						if (enc4 != 64) {
							output = output + String.fromCharCode(chr3);
						}

					}

					output = Base64._utf8_decode(output);

					return output;

				},
				_utf8_decode: function(utftext) {
					var string = "";
					var i = 0;
					var c = c1 = c2 = 0;

					while (i < utftext.length) {

						c = utftext.charCodeAt(i);

						if (c < 128) {
							string += String.fromCharCode(c);
							i++;
						} else if ((c > 191) && (c < 224)) {
							c2 = utftext.charCodeAt(i + 1);
							string += String.fromCharCode(((c & 31) << 6) | (c2 & 63));
							i += 2;
						} else {
							c2 = utftext.charCodeAt(i + 1);
							c3 = utftext.charCodeAt(i + 2);
							string += String.fromCharCode(((c & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63));
							i += 3;
						}

					}

					return string;
				}
			}
			return JSON.parse(Base64.decode(config));
		}
	},
	
	addListeners: {
		
		click: function() {
			// key-value pairs contain element id and function for event handler
			var elementsToCheck = {
				'loadcfg': 'processConfig',
				'resetcfg': 'resetConfig',
				'downloadbutton': 'downloadClick',
				'restorebutton': 'restoreClick',
				'old_cfg_options': 'showTextarea'			
			};
			
			document.addEventListener('click', function(evt) {
				var elementID = evt.target.id;
				
				if (elementsToCheck[elementID]) {
					var functionName = elementsToCheck[elementID];
					options.utils[functionName]();
					
					if (evt.target.tagName !== 'INPUT') {
						evt.preventDefault();
					}
				}
				
			});
		},
		
		keyup: function() {
			var keyupTimer;
			
			document.addEventListener('keyup', (evt) => {
				clearTimeout(keyupTimer);
				keyupTimer = setTimeout(options.save, 500);
			});
		},
		
		change: function() {
			var restoreButton = document.getElementById('restorecfg');

			restoreButton.addEventListener('change', (evt) => {
				options.restoreFromText(evt);
			});
			
			// listen for changes to checkboxes/textareas/etc
			document.addEventListener('change', options.save);
		}
	},
	
	ui: {	
		setColorPicker: function() {
			$('.color').ColorPicker({
				onChange : function(hsb, hex, rgb, el) {
					el.value = hex;
					options.save();
				},
				onSubmit : function(hsb, hex, rgb, el) {
					$(el).val(hex);
					$(el).ColorPickerHide();
					options.save();
				},
				livePreview : true,
				color : "",
				onBeforeShow : function() {
					$(this).ColorPickerSetColor(this.value);
				}
			});
		}
	},
	
	getDefault: function(callback) {
		var defaultURL = chrome.extension.getURL('/src/json/defaultconfig.json');
		var temp, defaultConfig;
		var xhr = new XMLHttpRequest();
		xhr.open("GET", defaultURL, true);
		xhr.onreadystatechange = function() {
			if (xhr.readyState == 4 && xhr.status == 200) {
				temp = JSON.parse(xhr.responseText);
				defaultConfig = JSON.stringify(temp);
				callback(defaultConfig);
			}
		}
		xhr.send();	
	},
	
	save: function() {
		var config = JSON.parse(localStorage['TZH-Config']);
		
		var checkboxes = $(":checkbox");
		for (var i in checkboxes) {
			config[checkboxes[i].id] = checkboxes[i].checked;
		}
		
		var textboxes = $(":text");
		for (var i in textboxes) {
			var textbox = textboxes[i];
			config[textbox.id] = textbox.value;
		}
		
		config.notificationDuration = document.getElementById('notificationDuration').value;
		
		config.last_saved = new Date().getTime();
		localStorage['TZH-Config'] = JSON.stringify(config);
	},
	
	restoreFromText: function(evt) {
		var file = evt.target.files[0];
		if (!file.type.match('text.*')) {
			alert("Not a text file...");
			return;
		}
		else {
			var reader = new FileReader();
			reader.onload = function(evt) {
				var textFile = evt.target.result;
				options.utils.processConfig(textFile);
			}
			reader.readAsText(file);
		}
	},
	
	show: function() {
		document.getElementById('cfg_ta').value = localStorage['TZH-Config'];
	},
	
	download: function(textfile) {
		options.save();
		var config = localStorage['TZH-Config'];
		var data = new Blob([config], {type: 'text/plain'})
		var textfile = window.URL.createObjectURL(data);
		return textfile;	
	}
};