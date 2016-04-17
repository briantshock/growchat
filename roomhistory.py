import pymongo, sys, json
from bson import json_util

from pymongo import MongoClient
client = MongoClient()

db = client.test

chatMessages = db['chat_messages']

def searchForText(room, text):
	for message in chatMessages.find({"$and": [{"room" : room},{"messageText" : {"$regex" : text}}]}):
		json_doc = json.dumps(message, default=json_util.default)
		print(json_doc)		
	sys.stdout.flush()

def getAllByRoom(room):
	for message in chatMessages.find({"room": room}).sort("timestamp"):
		json_doc = json.dumps(message, default=json_util.default)
		print(json_doc)		
	sys.stdout.flush()

if __name__ == '__main__':
	if len(sys.argv) > 2:
		searchForText(sys.argv[1], sys.argv[2])
	elif len(sys.argv) == 2:
		getAllByRoom(sys.argv[1])
	else:
		print('no room defined')


