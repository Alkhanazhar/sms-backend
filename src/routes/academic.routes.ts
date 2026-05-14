import express from "express";
import {
    createAcademicYear,
    getCurrentAcademicYear,
    updateAcademicYear,
    deleteAcademicYear,
    getAllAcademicYears,
} from "../controllers/academic.controller.js";
import { authorize, protect } from "../middleware/protect.js";


const academicYearRouter = express.Router();

academicYearRouter
    .route("/")
    .get(protect, authorize(["admin"]), getAllAcademicYears);

academicYearRouter
    .route("/create")
    .post(protect, authorize(["admin"]), createAcademicYear);

academicYearRouter.route("/current").get(protect, getCurrentAcademicYear);

academicYearRouter
    .route("/update/:id")
    .patch(protect, authorize(["admin"]), updateAcademicYear);

academicYearRouter
    .route("/delete/:id")
    .delete(protect, authorize(["admin"]), deleteAcademicYear);

export default academicYearRouter;
