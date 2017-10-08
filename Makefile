CC=java -jar toolchain/compiler.jar
CFLAGS=--js_output_file
BUILD_DIR=build
BUILD_SRC=$(BUILD_DIR)/src
BUILD_JS=$(BUILD_SRC)/js
SRC_JS=src/js

all: copy_files background options.js transloader.js notifier.js
	
copy_files:
	-mkdir build
	-mkdir dist 
	cp manifest.json options.html changelog.html $(BUILD_DIR) 
	cp -r lib/ $(BUILD_DIR) 
	-mkdir $(BUILD_SRC) 
	cp -r src/css src/images src/json $(BUILD_SRC) 
	-mkdir $(BUILD_JS)
	
background:
	$(CC) $(CFLAGS) $(BUILD_DIR)/background.js background.js
	
options.js:
	$(CC) $(CFLAGS) $(BUILD_JS)/options.js $(SRC_JS)/options.js

transloader.js:
	$(CC) $(CFLAGS) $(BUILD_JS)/transloader.js $(SRC_JS)/transloader.js
	
notifier.js:
	$(CC) $(CFLAGS) $(BUILD_JS)/notifier.js $(SRC_JS)/notifier.js	
	
clean:
	rm -rf build/*
