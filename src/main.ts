import { z } from "https://deno.land/x/zod@v3.20.2/mod.ts";
import {
  Err,
  None,
  Ok,
  Option,
  Result,
  Some,
} from "https://deno.land/x/optionals@v3.0.0/mod.ts";
import { EpicGamesPromotionsDTO } from "./dtos/check-promotions-epicgames-dto.ts";

const promotionScheme = z.object({
  title: z.string(),
  description: z.string(),
  url: z.string().url(),
  startDate: z.date(),
  endDate: z.date(),
});

type PromotionProps = z.infer<typeof promotionScheme>;

class Promotion {
  public readonly title!: string;
  public readonly description!: string;
  public readonly url!: string;
  public readonly startDate!: Date;
  public readonly endDate!: Date;

  private constructor(props: PromotionProps) {
    Object.assign(this, props);
  }

  static New(props: PromotionProps): Result<Promotion, Error> {
    const validation = promotionScheme.safeParse(props);

    if (!validation.success) return Err(JSON.stringify(validation.error));

    return Ok(new Promotion(validation.data));
  }
}

interface PromotionService {
  checkPromotions(): Promise<Option<Promotion[]>>;
}

const EpicGamesService: PromotionService = {
  checkPromotions: async () => {
    try {
      const res = await fetch(
        "https://store-site-backend-static-ipv4.ak.epicgames.com/freeGamesPromotions?locale=pt-BR&country=BR&allowCountries=BR",
      );

      if (!res.ok) {
        console.log("[checkPromotions] headers", res.headers);
        return None();
      }

      const { data }: EpicGamesPromotionsDTO = await res.json();

      const promotionsResults = data.Catalog.searchStore.elements.map((promo) =>
        Promotion.New({
          description: promo.description,
          title: promo.title,
          url: promo.productSlug === "[]" || ""
            ? `https://store.epicgames.com/pt-BR/sales-and-specials/holiday-sale`
            : `https://store.epicgames.com/pt-BR/p/${promo.productSlug}`,
          startDate: promo.promotions.promotionalOffers.length > 0
            ? new Date(
              promo.promotions.promotionalOffers[0].promotionalOffers[0]
                .startDate,
            )
            : new Date(
              promo.promotions.upcomingPromotionalOffers[0].promotionalOffers[0]
                .startDate,
            ),
          endDate: promo.promotions.promotionalOffers.length > 0
            ? new Date(
              promo.promotions.promotionalOffers[0].promotionalOffers[0]
                .endDate,
            )
            : new Date(
              promo.promotions.upcomingPromotionalOffers[0].promotionalOffers[0]
                .endDate,
            ),
        })
      );

      const validPromoResults = promotionsResults.filter((promo) =>
        promo.isOk()
      );

      if (validPromoResults.length === 0) {
        const invalidPromos = promotionsResults.map((invalidPromo) =>
          invalidPromo.unwrapErr()
        );
        console.log("[checkPromotions] no valid promotions", invalidPromos);
        return None();
      }

      const validPromos = validPromoResults.map((validPromoResult) =>
        validPromoResult.unwrap()
      );

      return Some(validPromos);
    } catch (error) {
      console.log("[checkPromotions] something goes wrong", error);
      return None();
    }
  },
};

const handlePromotions = async () => {
  const promosOption = await EpicGamesService.checkPromotions();
  if (promosOption.isNone()) return;

  const promoOutput = {
    updatedAt: new Date(),
    promotions: promosOption.unwrap(),
  };

  console.log(promoOutput);
};

function main() {
  handlePromotions();

  try {
    const REFRESH_RATE_MS = 60_000;

    setInterval(
      handlePromotions,
      REFRESH_RATE_MS,
    );
  } catch (error) {
    console.log("[main] error", error);
  }
}

main();
