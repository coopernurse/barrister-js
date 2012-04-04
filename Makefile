
all: browser node

clean:
	rm -rf dist

init:
	mkdir -p dist

browser: init
	cat src/client.js > dist/barrister.browser.js
	jshint dist/barrister.browser.js
	uglifyjs -o dist/barrister.browser.min.js dist/barrister.browser.js

node: init
	cat src/node_header.js src/client.js src/server.js src/node_footer.js > dist/barrister.node.js
	jshint dist/barrister.node.js
