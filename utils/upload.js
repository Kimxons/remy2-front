import axios from "axios";

const upload = async (file) => {
  const data = new FormData();
  data.append("file", file);
  data.append("upload_preset", "fiverr");

  try {
    const res = await axios.post(
      `${process.env.NEXT_PUBLIC_API_BASE_URL}/image/upload`,
      data
    );

    return res.data.secure_url;
  } catch (err) {
    console.error("Upload failed:", err);
    return null;
  }
};

export default upload;
