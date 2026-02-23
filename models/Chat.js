const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ["user", "assistant"],
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

const chatSchema = new mongoose.Schema(
  {
    repoUrl: {
      type: String,
      required: true,
    },
    repoName: {
      type: String,
      required: true,
    },
    namespace: {
      type: String,
      required: true,
      unique: true,
    },
    messages: [messageSchema],
    status: {
      type: String,
      enum: ["ingesting", "ready", "error"],
      default: "ready",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Chat", chatSchema);
