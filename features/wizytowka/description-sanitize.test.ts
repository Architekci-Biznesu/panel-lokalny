import assert from "node:assert/strict";
import {
  descriptionMentionsReviews,
  stripReviewFluffFromDescription,
} from "./description-sanitize";

{
  assert.equal(
    descriptionMentionsReviews(
      "Ponad 180 opinii potwierdza skuteczność naszej pracy.",
    ),
    true,
  );
  assert.equal(
    descriptionMentionsReviews("Oferujemy SEO i Google Ads w Polsce."),
    false,
  );
}

{
  const cleaned = stripReviewFluffFromDescription(
    "Architekci Biznesu to agencja w Polsce. Ponad 180 opinii potwierdza skuteczność naszej pracy. Siedziba firmy jest w Polsce.",
  );
  assert.ok(!descriptionMentionsReviews(cleaned));
  assert.ok(cleaned.includes("agencja"));
  assert.ok(cleaned.includes("Siedziba"));
  assert.ok(!cleaned.includes("opinii"));
}

{
  const cleaned = stripReviewFluffFromDescription(
    "Firma z oceną 4.8 na Google. Robimy strony WWW.",
  );
  assert.equal(cleaned, "Robimy strony WWW.");
}

console.log("description-sanitize tests passed");
