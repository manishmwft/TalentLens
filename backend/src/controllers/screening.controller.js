const fs = require("fs/promises");
const path = require("path");

const Candidate = require("../models/Candidate");
const Screening = require("../models/Screening");

const {
  extractResumeText,
} = require("../services/resumeParser.service");

function getRecruiterId(req) {
  return req.user?.id || req.user?._id;
}

async function removeFile(filePath) {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error("Unable to remove uploaded file:", error);
    }
  }
}

function serializeCandidate(candidate) {
  return {
    id: candidate._id,
    screeningId: candidate.screening,
    originalFileName: candidate.originalFileName,
    storedFileName: candidate.storedFileName,
    fileType: candidate.fileType,
    fileSize: candidate.fileSize,
    extractedText: candidate.extractedText,
    parsingStatus: candidate.parsingStatus,
    parsingError: candidate.parsingError,
    createdAt: candidate.createdAt,
  };
}

exports.createScreening = async function createScreening(req, res) {
  const uploadedFiles = req.files || [];

  try {
    const recruiterId = getRecruiterId(req);

    if (!recruiterId) {
      for (const file of uploadedFiles) {
        await removeFile(file.path);
      }

      return res.status(401).json({
        message: "Authentication is required.",
      });
    }

    const jobDescription = String(
      req.body.jobDescription || "",
    ).trim();

    if (!jobDescription) {
      for (const file of uploadedFiles) {
        await removeFile(file.path);
      }

      return res.status(400).json({
        message: "Job description is required.",
      });
    }

    if (jobDescription.length < 30) {
      for (const file of uploadedFiles) {
        await removeFile(file.path);
      }

      return res.status(400).json({
        message:
          "Job description must contain at least 30 characters.",
      });
    }

    if (!uploadedFiles.length) {
      return res.status(400).json({
        message: "Upload at least one PDF or DOCX resume.",
      });
    }

    const screening = await Screening.create({
      recruiter: recruiterId,
      jobDescription,
      totalCandidates: uploadedFiles.length,
      status: "Processing",
    });

    const candidateResults = [];

    for (const file of uploadedFiles) {
      const extension = path
        .extname(file.originalname)
        .replace(".", "")
        .toLowerCase();

      const candidate = await Candidate.create({
        screening: screening._id,
        recruiter: recruiterId,
        originalFileName: file.originalname,
        storedFileName: file.filename,
        filePath: file.path,
        fileType: extension,
        fileSize: file.size,
        parsingStatus: "Pending",
      });

      try {
        const extractedText = await extractResumeText(file);

        candidate.extractedText = extractedText;
        candidate.parsingStatus = "Parsed";
        candidate.parsingError = "";

        await candidate.save();
      } catch (parseError) {
        candidate.parsingStatus = "Failed";
        candidate.parsingError =
          parseError.message || "Resume parsing failed.";

        await candidate.save();
      }

      candidateResults.push(serializeCandidate(candidate));
    }

    const parsedCount = candidateResults.filter(
      (candidate) => candidate.parsingStatus === "Parsed",
    ).length;

    screening.status =
      parsedCount > 0 ? "Completed" : "Failed";

    await screening.save();

    return res.status(201).json({
      message: "Resume screening created successfully.",

      screening: {
        id: screening._id,
        jobDescription: screening.jobDescription,
        totalCandidates: screening.totalCandidates,
        status: screening.status,
        createdAt: screening.createdAt,
      },

      candidates: candidateResults,
    });
  } catch (error) {
    console.error("Create screening error:", error);

    for (const file of uploadedFiles) {
      await removeFile(file.path);
    }

    return res.status(500).json({
      message:
        error.message || "Unable to create resume screening.",
    });
  }
};

exports.getScreenings = async function getScreenings(req, res) {
  try {
    const recruiterId = getRecruiterId(req);

    const screenings = await Screening.find({
      recruiter: recruiterId,
    })
      .sort({
        createdAt: -1,
      })
      .lean();

    return res.status(200).json({
      screenings: screenings.map((screening) => ({
        id: screening._id,
        jobDescription: screening.jobDescription,
        totalCandidates: screening.totalCandidates,
        status: screening.status,
        createdAt: screening.createdAt,
      })),
    });
  } catch (error) {
    console.error("Get screenings error:", error);

    return res.status(500).json({
      message: "Unable to load screening history.",
    });
  }
};

exports.getScreeningById = async function getScreeningById(
  req,
  res,
) {
  try {
    const recruiterId = getRecruiterId(req);

    const screening = await Screening.findOne({
      _id: req.params.screeningId,
      recruiter: recruiterId,
    }).lean();

    if (!screening) {
      return res.status(404).json({
        message: "Screening not found.",
      });
    }

    const candidates = await Candidate.find({
      screening: screening._id,
      recruiter: recruiterId,
    })
      .sort({
        createdAt: 1,
      })
      .lean();

    return res.status(200).json({
      screening: {
        id: screening._id,
        jobDescription: screening.jobDescription,
        totalCandidates: screening.totalCandidates,
        status: screening.status,
        createdAt: screening.createdAt,
      },

      candidates: candidates.map(serializeCandidate),
    });
  } catch (error) {
    console.error("Get screening error:", error);

    return res.status(500).json({
      message: "Unable to load the screening.",
    });
  }
};