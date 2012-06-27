
all: mocha

clean:
	rm -rf dist
	rm -rf lib
	rm -rf docs

init:
	mkdir -p dist
	mkdir -p lib

json: init
	uglifyjs -nc -o dist/json2.min.js vendor/json2.js 

dist: browser node
	docco lib/barrister.node.js dist/barrister.browser.js
	rm -rf post-build
	mkdir -p post-build
	cp dist/*.js post-build

browser: json
	cat src/browser_header.js src/client.js src/browser_footer.js > dist/barrister.browser.js
	jshint dist/barrister.browser.js
	uglifyjs -nc -o dist/barrister.browser.min.js dist/barrister.browser.js

node: init
	cat src/node_header.js src/client.js src/server.js src/node_footer.js > lib/barrister.node.js
	jshint lib/barrister.node.js
	
barrister:
	barrister -j test/sample.json test/sample.idl
	
mocha: dist barrister
	mocha --reporter spec
