
all: browser node

clean:
	rm -rf dist

init:
	mkdir -p dist

json: init
	uglifyjs -nc -o dist/json2.min.js vendor/json2.js 

browser: json
	cat src/browser_header.js src/client.js src/browser_footer.js > dist/barrister.browser.js
	jshint dist/barrister.browser.js
	uglifyjs -nc -o dist/barrister.browser.min.js dist/barrister.browser.js

node: init
	cat src/node_header.js src/client.js src/server.js src/node_footer.js > dist/barrister.node.js
	jshint dist/barrister.node.js
