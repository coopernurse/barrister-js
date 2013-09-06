#!/usr/bin/env python

from bottle import route, run, request, response, static_file
import barrister

# Our implementation of the 'Calculator' interface in the IDL
class Calculator(object):

    # Parameters match the params in the functions in the IDL
    def add(self, a, b):
        return a+b

    def subtract(self, a, b):
        return a-b

contract = barrister.contract_from_file("calc.json")
server   = barrister.Server(contract)
server.add_handler("Calculator", Calculator())

@route("/api/calc", method='POST')
def calc():
    resp_data = server.call_json(request.body.read())
    response.content_type = 'application/json; charset=utf-8'
    return resp_data

@route("/angularjs/<filename>")
def angularjs(filename):
	return static_file(filename, root='angularjs')

run(host="127.0.0.1", port=7667)
