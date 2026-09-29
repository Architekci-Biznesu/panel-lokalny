import type { RatingKey } from "@/features/opinie/review-settings";

/**
 * One sample review per star rating: what the settings preview feeds into the
 * prompt (and the reply preview into the AI). Pure data, safe for the client.
 */
export const SAMPLE_REVIEWS: Record<
  RatingKey,
  { authorName: string; text: string }
> = {
  "1": {
    authorName: "Tomasz",
    text: "Bardzo źle. Nikt nie odbierał telefonu, a na miejscu nikt nie umiał mi pomóc.",
  },
  "2": {
    authorName: "Marek",
    text: "Czekałem dłużej niż zapowiadano i nikt mi nie wytłumaczył, co się dzieje.",
  },
  "3": {
    authorName: "Ewa",
    text: "Ogólnie w porządku, ale obsługa mogłaby być szybsza.",
  },
  "4": {
    authorName: "Piotr",
    text: "Dobra robota i uczciwa cena. Trochę długo czekałem na termin.",
  },
  "5": {
    authorName: "Anna",
    text: "Bardzo polecam, wszystko załatwione szybko i konkretnie. Miła obsługa.",
  },
};
