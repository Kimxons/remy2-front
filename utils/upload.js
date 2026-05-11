import axios from "axios";
import { buildApiUrl } from "./apiUrl";

const upload = async (file) => {
  const data = new FormData();
  data.append("file", file);
  data.append("upload_preset", "fiverr");

  try {
    const res = await axios.post(
      buildApiUrl("/image/upload"),
      data
    );

    return res.data.secure_url;
  } catch (err) {
    console.error("Upload failed:", err);
    return null;
  }
};

export default upload;
