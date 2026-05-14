"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var mongoose_1 = require("mongoose");
var connectDb = function () {
    try {
        if (!process.env.MONGODB_URI) {
            throw new Error("MONGODB_URI is not defined");
        }
        mongoose_1.default.connect(process.env.MONGODB_URI).then(function () {
            console.log("database connected");
        });
    }
    catch (error) {
        console.log("database connection error" + error);
    }
};
exports.default = connectDb;
