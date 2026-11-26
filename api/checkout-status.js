import { handleCheckoutStatus } from "../server/stripe.js";

export default async function handler(req, res) {
  await handleCheckoutStatus(req, res, process.env);
}
