const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth.routes");
const screeningRoutes = require("./routes/screening.routes");

const uploadErrorHandler = require("./middleware/uploadError.middleware");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/api/v1/health", function healthCheck(req, res) {
  res.status(200).json({
    message: "API is running.",
  });
});

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/screenings", screeningRoutes);

app.use(uploadErrorHandler);

app.use(function notFoundHandler(req, res) {
  res.status(404).json({
    message: "Route not found.",
  });
});

app.use(function globalErrorHandler(error, req, res, next) {
  console.error(error);

  res.status(error.status || 500).json({
    message: error.message || "Internal server error.",
  });
});

module.exports = app;