# Barrister Javascript Bindings

Develop type safe contracts for your web services!

* Usable from Node.js (client and server) or a web browser (client only)
* For an overview of Barrister RPC, visit: http://barrister.bitmechanic.com/

## Installation

For Node.js:

    npm install barrister
    
For web browsers:

    # download either of these:
    curl http://barrister.bitmechanic.com/dist/js/latest/barrister.browser.js  > barrister.browser.js
    curl http://barrister.bitmechanic.com/dist/js/latest/barrister.browser.min.js > barrister.browser.min.js
    
    # download Crockford's json2.min.js to provide JSON support
    curl http://barrister.bitmechanic.com/dist/js/latest/json2.min.js > json2.min.js
    
## Demo

https://github.com/coopernurse/barrister-demo-contact/tree/master/js

* Includes a Node.js server implementation using Express
* Includes both Node.js and browser based clients you can test against the server

## More Information

* Read the [IDL Docs](http://barrister.bitmechanic.com/docs.html) for more info on writing 
  Barrister IDL files
* View the annotated source:
  * [Node.js](http://barrister.bitmechanic.com/api/js/latest/barrister.node.html)
  * [Browser](http://barrister.bitmechanic.com/api/js/latest/barrister.browser.html)
* [Barrister Google Group](https://groups.google.com/forum/#!forum/barrister-rpc) - Post questions and ideas here

## License

Distributed under the MIT license.  See LICENSE file for details.

## Release / Tag notes

Note to self on how to tag release

    # Edit package.json, bump version, then run:
    
    make clean all
    git add -u
    git commit -m "bump npm v0.1.0"
    git tag -a v0.1.0 -m "version 0.1.0"
    git push --tags
    npm publish
    
