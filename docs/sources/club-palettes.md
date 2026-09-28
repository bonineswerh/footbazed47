# Club color treatment

The swatches in `js/domain.js` are editorial UI colors, not licensed crests or claimed official brand hex values. They are muted before use and mixed with theme surfaces. Club identity remains readable in text even when the teams have similar colors.

The catalogue includes canonical and provider short names. Barcelona has blue and garnet, Atlético red and blue, Brighton blue and white; PSG uses a single navy and Real Madrid a single cream by the owner's design brief. Unknown clubs use a neutral fallback; names cannot inject CSS. No remote images are downloaded for these treatments.

Home-kit reference collections checked during this update:

- [Premier League, all 20 clubs, 2025/26](https://www.premierleague.com/en/news/4309019)
- [Bundesliga, 2025/26 club kits](https://www.bundesliga.com/en/bundesliga/news/new-jerseys-home-away-2025-26-season-bayern-munich-borussia-dortmund-buy-online-32054)
- [Ligue 1, 2025/26 club kits](https://ligue1.com/fr/articles/l1_article_2659-les-maillots-de-la-saison-2025-2026-l1)
- [Serie A club directory](https://www.legaseriea.it/team)
- [LaLiga club directory](https://www.laliga.com/en-US/laliga-easports/clubs)

These references support the visual direction, not a claim that every swatch is a certified brand color. The data provider's [team resource](https://docs.football-data.org/general/v4/team.html) includes `clubColors`; squad import retains that field for checking and future catalogue maintenance. Existing legacy records inspected on 2026-09-26 had no populated color fields.

To add a club, confirm its identity and home colors, add exact aliases and two safe hex swatches (or repeat one for a single-color treatment), and check a dark/light match card. Avoid substring matching, arbitrary hash-derived colors, and animated gradients.

The 2026-09-28 provider catalogue was checked against the registry: all 111 imported club names resolve to an explicit palette. New entries use the provider's `clubColors` field. Venezia's orange/green accents on a black kit also follow its [official 2026/27 home announcement](https://en.veneziafc.it/news/26-27-home-jersey). Sabah's blue/white treatment is an editorial approximation; the provider does not supply `clubColors` for it.
