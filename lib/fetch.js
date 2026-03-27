import axios from "axios";

export async function fetchHTML(url) {
  const res = await axios.get(url);
  return res.data;
}