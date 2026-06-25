import { getJoyworldToken, getOrderDetail } from "./src/services/joyworldService.js";
async function run() {
  const token = await getJoyworldToken();
  const res = await getOrderDetail(token, "2e7e2f1e-ee31-4a03-be8c-4593d2ac2c98");
  console.log(JSON.stringify(res, null, 2));
}
run();
