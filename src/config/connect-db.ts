import mongoose from "mongoose";

const connectDb = () => {
    try {
        if (!process.env.MONGODB_URI) {
            throw new Error("MONGODB_URI is not defined")
        }
        mongoose.connect(process.env.MONGODB_URI).then(
            () => {
                console.log("database connected")
            }
        )
    } catch (error) {
        console.log("database connection error" + error)

    }
}

export default connectDb