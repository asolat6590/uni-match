import { handleCheckout } from "../server/stripe.js";

export default async function handler(req, res) {
  await handleCheckout(req, res, process.env);
}
