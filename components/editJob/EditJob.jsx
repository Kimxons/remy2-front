"use client"

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import httpClient from "../../api/httpClient";
import "./EditJob.scss";

const EditJob = () => {
  const { id } = useParams();
  const [title, setTitle] = useState("");
  const [format, setFormat] = useState("");
  const [subjects, setSubjects] = useState([]);
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);

  const gigTitles = [
    "Essay Writing",
    "Research Paper",
    "Case Study",
    "Exam Help",
    "Quiz Help",
    "Tutoring Session",
    "Presentation",
    "Report Writing",
  ];

  const formats = [
    "APA",
    "MLA",
    "Chicago/Turabian",
    "Harvard",
    "IEEE",
    "AMA",
    "Vancouver",
  ];

  const subjectAreas = [
    "Mathematics",
    "Biology",
    "Chemistry",
    "Physics",
    "Computer Science",
    "Economics",
    "History",
    "Literature",
    "Philosophy",
    "Sociology",
  ];

  useEffect(() => {
    const fetchJob = async () => {
      try {
        const res = await httpClient.get(`/jobs/${id}`);
        setTitle(res.data.title);
        setFormat(res.data.format);
        setSubjects(res.data.subjects);
        setDescription(res.data.description);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchJob();
  }, [id]);

  const handleSubjectChange = (e) => {
    const value = e.target.value;
    if (subjects.includes(value)) {
      setSubjects(subjects.filter((s) => s !== value));
    } else if (subjects.length < 5) {
      setSubjects([...subjects, value]);
    } else {
      alert("You can select up to 5 subjects only.");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await httpClient.put(`/jobs/${id}`, {
        title,
        format,
        subjects,
        description,
      });
      alert("Job updated successfully!");
    } catch (err) {
      console.error(err);
      alert("Failed to update job");
    }
  };

  if (loading) return <div>Loading job...</div>;

  return (
    <div className="edit-job">
      <h1>Edit Job</h1>
      <form onSubmit={handleSubmit}>
        <label>Gig Title:</label>
        <select value={title} onChange={(e) => setTitle(e.target.value)} required>
          <option value="">-- Select --</option>
          {gigTitles.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>

        <label>Format:</label>
        <select value={format} onChange={(e) => setFormat(e.target.value)} required>
          <option value="">-- Select --</option>
          {formats.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>

        <label>Subjects (max 5):</label>
        <div className="subjects">
          {subjectAreas.map((s) => (
            <div key={s}>
              <input
                type="checkbox"
                value={s}
                checked={subjects.includes(s)}
                onChange={handleSubjectChange}
              />
              {s}
            </div>
          ))}
        </div>

        <label>Description:</label>
        <textarea
          rows="5"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
        />

        <button type="submit">Update Job</button>
      </form>
    </div>
  );
};

export default EditJob;
