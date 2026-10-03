const multer = require("multer");

function uploadErrorHandler(error, req, res, next) {
  if (!error) {
    return next();
  }

  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        message: "Each resume must be 5 MB or smaller.",
      });
    }

    if (error.code === "LIMIT_FILE_COUNT") {
      return res.status(400).json({
        message: "You can upload a maximum of 10 resumes.",
      });
    }

    if (error.code === "LIMIT_UNEXPECTED_FILE") {
      return res.status(400).json({
        message:
          'Resume files must be uploaded using the field name "resumes".',
      });
    }

    return res.status(400).json({
      message: error.message,
    });
  }

  if (
    error.message ===
    "Only PDF and DOCX resume files are allowed."
  ) {
    return res.status(400).json({
      message: error.message,
    });
  }

  return next(error);
}

module.exports = uploadErrorHandler;