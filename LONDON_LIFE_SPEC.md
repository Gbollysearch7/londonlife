# London Life Game Design Specification

A detailed specification for an original London life simulation, informed by hands-on study of Lagos Life. The intended builder is Claude. Build the connected game described here, with a beautiful, cohesive London world and working progression; do not reduce it to a dashboard or a collection of disconnected menus.

---

## 1. Product direction

The player makes a life in London. They start with circumstances they did not choose, then manage six needs, build skills, work, travel, furnish a home, form relationships and pursue an ambition. The city provides opportunities at different costs and levels of access. The same persistent character exists across home, streets, venues, phone apps and social systems.

The emotional promise is a recognisable London life with room for humour, aspiration and small daily victories. A shared room, a good meal, a first paid gig and a flat of your own should each feel like progress. Borough Market, a crowded bus, Camden music, a late Soho evening and a view over the Thames should have different character, activities and social possibilities.

Use Lagos Life as a behavioral reference. Create original London names, dialogue, stories, branding and assets. Preserve the interdependence between systems. Do not copy its source code, artwork or story text.

## 2. Evidence and specification labels

- **OBSERVED SOURCE:** behavior or a rule visible in the live Lagos Life interface.
- **PLAYED SOURCE:** an action was performed and its result was checked.
- **LONDON REQUIREMENT:** behavior the London game must implement.
- **DESIGN DEFAULT:** a proposed parameter when the original's internal calculation cannot be established.
- **OPEN QUESTION:** an unresolved choice or an inaccessible source behavior.

These labels prevent an assumption from becoming a false implementation requirement. Exact internal formulas are not established by reading a menu. Where the interface disagrees with itself, retain the discrepancy and decide the London rule explicitly.

Research currently includes 160 recorded screens and interactions, a payable partial work shift, cooking and showering, a furniture purchase and placement, public transport, an NPC conversation, free-roaming street movement, reward claims and a complete five-step branching story. Wider economy, government, family, games, policing and business menus were inspected. Several systems were gated by account age, wealth, relationship status or long real-time timers.

## 3. Core player loop

Care for needs → travel to an opportunity → work, learn or socialise → earn money, skill experience and reputation → improve the home and assets → unlock better opportunities → advance the ambition.

Every system must connect to at least one other persistent system. Examples: a cooker requires groceries; a desk enables coding at home; rest improves a shift; a certificate benefits a career; transport reaches a story step; a friendship enables a richer interaction; furniture and vehicles contribute to wealth; rent and wages create ongoing commitments.

There must be no fake success states. A purchase changes balance and inventory together. A journey changes location only on arrival. A timed action rewards the character once. A mission becomes claimable only after the qualifying action. A relationship request requiring another player's consent does not take effect when only one person clicks.

## 4. Intended implementation sequence

First establish persistent character state, identity, server-authoritative actions, the home and the London map. Then implement the full needs–skills–career–money–housing loop. Add venue content and stories on that foundation. Add real-player presence, communication, visits and consent flows before competitive games, player work and governance. Late-game economy and institutions depend on those foundations.

The phases are build order, not permission to ship empty buttons. Every exposed control must work, explain an unmet requirement, or be clearly marked as unavailable. Never present simulated users as real online players. Never replace a multiplayer game with a cosmetic lobby.

This document will expand with precise system rules, screen flows, London content, data contracts, visual direction and acceptance tests. Full parity features and unresolved decisions will remain visible rather than being silently omitted.

## 5. Character creation and persistent identity

### 5.1 Observed source

The source provides character appearance, two traits and one lifetime ambition before assigning starting circumstances. The origin is assigned once. The played character received an advantaged origin, a furnished flat, an owned vehicle and a higher starting career rank; this origin also changed who paid the rent and unlocked a daily parental-money interaction. This is a persistent modifier, not just a story label.

### 5.2 London requirements

Separate account identity from the fictional character. One signed-in account owns one active character. Character names and public handles are distinct from authentication credentials. Do not expose email or account identifiers in player lists. Appearance consists of body presentation, skin tone, hairstyle, hair colour, top, bottom, footwear and the current outfit context. Store owned wardrobe items separately from equipped appearance.

The creation flow is appearance → two traits → ambition → origin reveal → first-home tour. Confirm the final selection before assigning an origin. Assignment occurs on the server exactly once and writes starting money, home, job, vehicles, skill advantages and family modifiers in one transaction. Refreshing, using Back or opening another tab must not reroll it. A failed network response must allow the player to recover the same character.

London origin archetypes should include newly arrived student, graduate renting a room, working Londoner, creative starting out, family-supported professional and inherited wealth. These are fictional circumstances, not classifications inferred from the user's real identity. Weighting and starting packages are DESIGN DEFAULTS to balance, not known source probabilities. Show the complete package before the player enters the city. Avoid making any origin unwinnable.

Traits must change mechanics, with the effect visible in their descriptions. Provide ambitious, sociable, active, creative, technology-oriented, foodie, tidy, easygoing and at least two contrasting traits with meaningful tradeoffs. Exactly two distinct traits are required. A trait's multiplier must not apply twice through both a client preview and a server calculation.

Five initial ambition families: highest career rank; a wealth or home-ownership target; music mastery; four close friendships; and building a successful company. Store progress against explicit predicates. Completion awards once. The source permits changing the ambition once a week; London should retain a clearly displayed cooldown and preserve earned rewards without letting ambition swapping farm duplicate completion gifts.

### 5.3 Acceptance criteria

Appearance remains the same in the home, city, venue, street and profile. Two identical traits cannot be submitted. Origin assignment survives reload and repeated requests. Owned outfits survive switching contexts. The same character is loaded on a second device. Completing an ambition cannot pay again on another refresh.

## 6. Main interface and navigation contract

**OBSERVED SOURCE:** the game is the main screen. A persistent HUD shows time, weather, mood, money and six needs. The navigation exposes the active scene, buying, map and phone. A profile area contains Needs, Goals, Skills, People, Career and Settings. A clean-screen control reduces interface clutter. The phone groups broader systems into apps.

**LONDON REQUIREMENT:** open directly into the playable scene after sign-in and creation. Do not put a marketing hero above the game. The world occupies the main viewport, with lightweight panels layered over it. Money, activity progress and location must remain legible without covering the player. On mobile, panels become bottom sheets; the phone becomes a touch-friendly full-height sheet. Provide an explicit close control, safe-area spacing and a way to reopen the current location's actions.

Define five view states: city map, active home interior, venue interior, free-roaming street and phone/modal overlay. Changing a view is not the same as changing a physical location. Opening Map or Phone must not cancel a valid activity or teleport the character. The source's Home navigation sometimes returns to the active scene rather than the owned home; London should remove the ambiguity by using Scene for the current place and Go home for a real journey.

Every overlay needs an unambiguous title, Back, Close, loading, empty, error and permission/gate states. Keep the previous screen and selected tab when closing a nested sheet. Do not lose a typed message, company name or bank amount because a background state refresh runs. Escape closes the topmost dismissible layer; a destructive confirmation remains separate.

Location buttons projected into the 3D scene must not become unusable behind the HUD. Also provide a searchable directory with district, cost/access information, opening hours and current-location status. Keyboard users must be able to reach locations and action controls without clicking the canvas. Show the action, duration, money cost, need effects, skill rewards and prerequisites before commitment.

The phone must support Jobs, Messages, Contacts, Games, Courses, Travel, Food delivery, Bank, Wardrobe, Rankings, Homes, Vehicles, Invitations, Health, Investments, Insurance, Family, Staff, Player work, Transport company, Company, Player shops, City feed, Government, Police, Court, Advertising, Help and Settings. External promotional app links in the source are not required gameplay systems and should not be copied into the London phone.

## 7. Needs, moods, illness and time

### 7.1 Needs model

**OBSERVED SOURCE:** Hunger, Energy, Fun, Social, Hygiene and Bladder decay and are restored by different actions. Food, rest, entertainment, conversations, washing and toilets provide distinct recovery routes. Good housing and vehicles can contribute mood modifiers. The played meal restored Hunger to 100; showering restored Hygiene to 100. Exact base decay rates and the mood aggregation formula remain unverified.

**LONDON REQUIREMENT:** represent each need on a 0–100 scale and clamp it after every settlement. Store the last-settled timestamp; derive elapsed time from the server. Apply base decay, trait/perk modifiers, active-activity changes and environment effects in a documented order. A client may animate a preview, but it cannot award final effects. Never subtract the same offline interval twice.

Low needs must change available choices or outcomes: low energy reduces performance or blocks strenuous actions; hunger reduces comfort and work effectiveness; prolonged poor hygiene creates a negative mood and affects social responses; low social and fun reduce mood; low bladder motivates a toilet visit. A warning must explain the practical consequence and offer a feasible recovery route. Do not stack invisible penalties until the character becomes unusable.

Mood is an aggregate of current needs plus time-bounded modifiers. Store a modifier's source, strength, expiry and stacking rule. Replacing a vehicle or moving home replaces the relevant persistent modifier. Buying ten copies of a chair must not stack ten identical mood bonuses unless intentionally designed. The profile should explain what is making the character feel good or bad.

### 7.2 Clock contract

Separate wall-clock duration, city-local calendar and any presentation clock. **OBSERVED SOURCE:** work and classes have substantial real-time timers; daily and weekly economy uses calendar rules. London's recurring schedule should use Europe/London, including daylight-saving changes. **DESIGN DEFAULT:** daily rewards reset at local midnight, business settlement runs at 18:00, bills fall due Saturday at 09:00 and weekly elections close Sunday at 20:00. Final scheduling must be consistent across the UI, server and notifications.

Development may accelerate time only behind an explicit development configuration. Production duration must not silently become a 45-second shift because that is convenient for a demonstration. Keep timer parameters in content/configuration rather than hardcoding them in individual buttons. Account for reconnects, clock changes and daylight-saving boundaries using absolute server timestamps.

Decide and document an offline-decay cap. A proposed cap must be labelled as a London choice until tested against the original. Long absence should not permanently ruin a new player. Any forgiveness policy must be explicit, applied once and logged; refresh must not repeatedly claim offline income or repeatedly charge the same bill.

### 7.3 Health

**OBSERVED SOURCE:** sustained low needs can lead to illness, with chemist/delivery and hospital recovery paths. **LONDON REQUIREMENT:** health conditions have severity, onset, visible symptoms, affected actions, recovery options and costs. Hospital and community support routes must remain accessible to a broke character. This is fictional simulation health, not medical advice or a diagnosis based on real user data.

## 8. Activity engine and cancellation

All actions use a common activity definition: id, location/sub-area, label, duration, entry cost, consumed inventory, required furniture or skill, need changes, skill experience, money/reputation/star rewards, cooldown, opening-hours gate and cancel rule. Availability is calculated from current authoritative state. Disabled buttons state which requirement is missing.

Use an explicit lifecycle: available → requested → running → ready to finish → settling → completed, or cancelled/failed. Persist activity id, start and end timestamps, location, committed costs, deterministic event seed and settlement status. A reconnect reconstructs the same running action. The server atomically marks completion and awards effects. An operation id protects against duplicate retries.

Costs can be charged at start and rewards at completion, but the rule must be consistent and visible. Consumed ingredients are not returned by cancelling halfway through cooking. A venue entry fee is not refunded after admission unless the product explicitly says so. Cancelling work must follow the paid-exit policy, not the generic cooking policy. Server failure must distinguish an action that never committed from one that committed but lost its response.

Opening another app is allowed during many activities. Starting a conflicting action, moving location, selling the required appliance or changing jobs during a shift needs a defined rule. **DESIGN DEFAULT:** one principal physical activity at a time; passive income and message reading continue. Queueing can be added later only with clear order, cancellation and cost semantics.

## 9. Skills and learning

**OBSERVED SOURCE:** nine skills are Cooking, Charisma, Fitness, Coding, Music, Hustle, Dance, Comedy and Photography; the displayed maximum is ten. Activities and home equipment train particular skills. The guide describes rust after seven inactive days, roughly one level per twenty days, bounded to at most two below a personal best. Treat the exact rust interval and rounding as a rule to verify before implementation.

**LONDON REQUIREMENT:** retain the nine underlying skills; display Hustle as Enterprise if that better fits the London voice. Keep experience, current level, personal best and last-used time separately. Each activity declares its trained skill and base experience. Apply trait and fast-learning modifiers once. Gate jobs, dialogue, story choices, classes and earning opportunities using explicit skill predicates, including OR conditions where relevant.

Show current level, progress to the next level, recent improvement and where to practise. A locked job must name the skill and threshold and link to an affordable training route. Do not assign every profession the same generic charisma mechanic: cooking supports kitchens, coding supports technology, fitness supports physical work, music supports performance and photography supports visual work.

Course definitions contain five sequential lessons, prerequisite lesson, class venue, fee, duration, notes, three assessment questions, passing threshold, experience reward, one-star lesson reward, certificate and career benefit. **OBSERVED SOURCE:** classes last 45 real minutes, new classes are limited to two per day, completed notes remain readable anywhere and a five-lesson certificate awards three additional stars. The software certificate advertised a 15% performance benefit for its career.

Source course families: law, medicine, software development, banking, cooking, music, fashion design, aviation, property, broadcasting, entrepreneurship, civil engineering and financial literacy. London should supply original lesson content for each family, not five repeated copies of the same quiz. Record attempts and scores, allow reviewed notes, prevent paying for an already completed course by mistake and define whether a failed class counts toward the daily attendance limit.

**Acceptance:** a skill gate is enforced by the server; the profile and action sheet show the same level; rust is applied once; sequential lessons cannot be skipped; the two-class limit is shared across tabs and devices; certificate rewards cannot repeat; the right career receives the stated benefit.

## 10. Careers, shifts and promotions

### 10.1 Verified source structure

The source Jobs catalogue contained 33 career entries across Lagos, Abuja and Port Harcourt. Careers expose a starting role, shift pay, skill association, workdays, city, workplace and optional skill gate. The inspected Banking character was rank three of five, Branch Manager I, paid ₦27,400 per full shift. The next grade was Branch Manager II at ₦28,800. Its panel required two shifts in the current grade and 100% performance at the end of a shift. Do not assume a universal three-shift threshold.

The Jobs app described one-hour shifts available at any time, while the career panel displayed 08:00–17:00. This is a source inconsistency. **LONDON DESIGN DEFAULT:** retain a one-real-hour shift and define explicit entry windows per career, with a clearly stated grace rule. If anytime shifts are chosen instead, remove conventional schedule claims everywhere. Show whether the character has already worked on the relevant calendar day.

A payable early exit became available after six real minutes. The played partial shift earned ₦7,900 before tax and increased performance by nine points. Four successful work tasks advertised an additional 15% pay. A missed timed task produced no success credit. These facts do not establish the exact proportional-pay or task-scheduling formula.

### 10.2 London work contract

Career definitions contain five ranks and subgrades, rank/grade salaries, workplace, primary training skill, entry predicate, workdays, shift duration, minimum paid duration, promotion threshold and required completed shifts. Career progress stores performance, completed shifts at the current grade, shift history, certificates and the last workday. Keep switching, quitting and rejoining behavior explicit; do not let a switch reset cooldowns or generate repeated signing rewards.

A shift is a persistent session with stages such as commute, briefing, tasks, break, review and wrap-up. Provide steady work, hard work, socialising, impressing the manager and taking it easy. Each style has visible tradeoffs in performance, energy, fun, social need and pay. Allow changing style during the shift; integrate elapsed time under each style rather than applying only the style selected in the final second.

Tasks can be a timed dexterity challenge, a job-specific decision or a short problem. Store answer/outcome on the server; settle each task once. Job context matters: a kitchen task differs from a banking task and a music task. Risky and safe event choices need declared or discoverable consequences. Failure should reduce a bonus or performance, not silently delete the entire shift.

Early exit shows the amount earned so far, tax, lost completion rewards and promotion consequences before confirmation. Below the minimum paid duration, say that the shift will pay zero. After completion, show gross pay, tax, net pay, performance change, trained skill, completed-shift count and any promotion. All changes are recorded in one settlement.

Promotion evaluates only after a qualifying shift is settled. At 100% performance and the required shift count, advance one grade or rank; apply the new salary to future shifts. A single settlement must not promote repeatedly through multiple ranks unless an explicit catch-up rule says so. At the highest grade, keep performance meaningful without awarding endless promotion stars.

### 10.3 London career families

Include technology, banking, music, market trading, nursing, hair and beauty, cooking, DJ/events, fitness, content creation, teaching, event production, football/media, retail, law, medicine, public service, broadcasting, property, aviation, product management, airport operations, transport, hospitality, security and infrastructure/engineering. Replace Nigerian city-specific jobs with distinct London roles rather than deleting their economic functions.

Example technology ranks: Intern → Junior Developer → Developer → Team Lead → CTO. Example hospitality ranks: Kitchen Porter → Commis Chef → Chef de Partie → Head Chef → Restaurateur. Example banking ranks: Customer Adviser → Banker → Branch Manager → Regional Director → Managing Director. These are LONDON CONTENT DEFAULTS. Author the complete five-rank/subgrade table for every included career before coding, with salary progression and gates in content data.

**Acceptance:** styles applied over time; task reward once; minimum-pay gate enforced; one shift cannot run in two tabs; changing device resumes the same shift; the pay preview matches settlement; the next-grade requirement is correct; job switching during a shift is blocked or explicitly settles/quits it; promotion cannot fire on a profile refresh.

## 11. Homes, tenancy and ownership

**OBSERVED SOURCE:** home types range from a 6×6 room and university hall to a 14×14 mansion. Weekly rent, move-in cost and outright purchase are distinct. Move-in generally equals three times weekly rent. Furniture moves with the player. An origin may subsidise rent. Buying the occupied home removes its rent. Other cities can have additional homes.

Important distinction: the investment-property purchase table is not the same as the price to buy the home occupied by the character. The source showed a Lekki flat at ₦910,000 for residential ownership and ₦210,000 in the separate landlord-investment catalogue. Store residential homes, investment properties and player tenancies as separate products; do not accidentally apply the cheaper investment price to a residence.

**LONDON CONTENT DEFAULT:** student hall/shared room → outer-London studio → one-bedroom flat → family terrace → premium townhouse → riverside penthouse → luxury mansion. Each tier has district, room grid, entrance/yard, guest capacity, rent, move-in charge, purchase price, deposit treatment, staff eligibility, furnishing limits and a mood bonus. Prices are fictional balancing values, not a claim about actual London property markets.

Moving is a transaction: validate money and eligibility, reserve the destination, calculate move costs and the old tenancy, transfer or store every furniture item, validate placement, update the active home, settle staff eligibility and announce arrival. Large furniture that cannot fit goes into storage; it must not disappear. Give the player a preview of items that need rearranging. Existing paint/floor purchases remain owned, even if the new property needs a different layout.

A tenancy has landlord/property, tenant, start/end, weekly rent, deposit, payment schedule and status. Player renting can use one-to-four-week terms; the source advertised prices around 70% of ordinary rent. That discount is an OBSERVED SOURCE rule requiring explicit London adoption. Expiration, eviction, unpaid rent and leaving early need visible outcomes and recovery routes. An owner cannot sell a tenanted property without resolving the tenancy.

Investment homes have an ownership cap; the inspected source allowed five. Display rent income, collection balance, valuation and any maintenance costs. Bare plots are another asset class, capped at twenty in the source guide. Building a residence on land involves stages and construction work, not an instant relabelling of a plot.

**Acceptance:** residence ownership stops the correct rent; moving transfers all possessions; no item is lost when downsizing; home and tenancy states survive reload; bills honor origin subsidies; landlord and tenant cannot both claim the same rent twice; personal-home and investment prices remain distinct.

## 12. Furniture, placement and the home scene

**OBSERVED SOURCE categories:** Design, Sleep, Kitchen, Bath, Comfort, Fun, Skills, Light, Decor, Pets and Luxury. Items have varying footprints including 1×1, 2×1, 2×2, 3×1 and 3×3, plus wall and yard placements. Quality stars and colour counts are visible. The placement flow was played: select an item, position it, rotate it, and commit. Keyboard and on-screen controls coexist.

**LONDON REQUIREMENT:** store an item instance separately from its catalogue definition. The instance has owner, home/storage location, grid position, rotation, colour, condition and any upgrades. The definition has price, resale value, footprint by rotation, allowed surface, quality, power/water dependency, model, interaction anchors and supported actions.

Buying and placing are separate stages. A ghost previews validity and price; green means valid, red explains collision or an invalid surface. Preserve money until the agreed purchase/placement commit point, and state the rule clearly. Existing items can be moved and rotated without repurchasing. Wall-mounted items need wall anchors and height; yard objects need an outdoor zone. A 2×1 object becomes 1×2 on rotation. Collision validation uses the full footprint.

Supply Move, Rotate, Place, Store and Cancel controls, with keyboard equivalents and accessible buttons. R rotates, Enter places and Escape cancels; arrow keys move a selected ghost. Touch uses drag-to-position plus Rotate and Place, without requiring hover. Camera rotation is a separate gesture so moving a sofa does not spin the whole room.

Furniture supports actual behavior: bed/sleep; cooker/recipes; fridge/food and groceries; shower/washing; toilet/bladder; TV/entertainment; desk/coding; instrument/music; exercise equipment/fitness; speakers/house party; camera or studio/photography; books/study; console/games. Furniture quality can change recovery speed, comfort or skill gain, with the difference shown before purchase.

Design mode offers walls, floors and lighting finishes that can be tried before buying. Preview does not change other visitors' persistent view until confirmed. Owned finishes remain reusable. The home renderer must place and animate the actual owned instances, not a generic room that ignores the inventory. Guest permissions are applied to appliance actions; the played source exposed a kitchen-use toggle.

**Acceptance:** collision after rotation works; a wall item cannot be placed on the floor; every purchased item appears in the saved room or storage; cancellation does not charge twice; selling removes the instance and credits once; visitors see committed changes; camera controls and item controls do not fight.

## 13. Utilities, food and household routines

**OBSERVED SOURCE:** some appliances require electricity; generators and solar provide alternatives. A gas cooker advertised cooking 30% faster. Kitchen inventory contains named ingredient quantities, recipes consume particular items, and higher recipes can require Cooking level two. Food delivery provides both meals and groceries; player shops are another supply route.

**LONDON ADAPTATION:** retain the utility dependency, but use London-relevant bills, heating, hot water, energy efficiency and occasional maintenance/outages rather than importing NEPA as a London institution. A low-cost stove must still provide a feasible meal when an electric appliance is unavailable. Any outage is a game event, not a claim about current real-world utility service.

Groceries are stackable inventory with unit, quantity, purchase price and optionally freshness. A recipe defines ingredient amounts, cooking skill gate, duration, appliance class, quality multiplier, hunger/fun effects and servings. Validate all ingredients atomically before consuming them. Guests with kitchen permission consume the host's ingredients only if that permission explicitly includes it. A fridge cannot create free ingredients on every reload.

London recipe families should include tea and toast, beans on toast, jacket potato, vegetable curry, pasta, pie and mash, a proper breakfast, roast dinner, Caribbean rice and peas, West African rice dishes and market-inspired meals. Do not make London food culture homogeneous. Skill-gated dishes need a clear affordable path from simpler recipes.

Food delivery flow: choose meal or groceries → show total and delivery time → pay → pending delivery → arrival/inventory or consumption → history. Delivery can find the character after a legal location change; define address/location binding. Failure must refund or reschedule once, without duplicating goods.

Household staff: cleaner, chef, driver, security and nanny. **OBSERVED SOURCE:** first wages are prorated to Saturday 09:00, future wages join rent; paid wages are not refunded when staff leave; smaller homes, sold vehicles or absent children can remove eligibility. Chef support was capped at three meals per day, not unlimited food. London contracts need explicit services, frequency, eligibility and wages. The nanny operates on actual child state.

## 14. Travel, vehicles and streets

**OBSERVED SOURCE:** free walking; several public-road options; taxi; owned car; driver option; distance-based costs; fuel; traffic, weather and incidental levies; multiple ride cameras; skip-ride control. Street mode adds free roaming, nearby-location distances and animated traffic. Flight/coach routes connect the three cities, with the trip to the departure point included.

**LONDON REQUIREMENT:** walk, bus, Tube, taxi/ride-hail, bicycle and owned car, plus river services where appropriate. Show fare, duration, route, fuel and any relevant interruption before travel. Use a fictional fare table for balancing. A transit-policy modifier applies exactly once to the quoted eligible fare. Ownership enables the relevant vehicle choice; hiring a driver changes speed/fuel rules visibly.

Travel has requested, departing, in-transit, arrived, cancelled and interrupted states. Deduct the fare once, keep the origin during transit, and assign the destination on arrival. A visual Skip ride finishes the animation, not an arbitrary server timer or free fare. Reconnect resumes the same journey or its settled destination. A cancelled journey cannot leave the character in two places.

For the map, use districts and clear connections rather than claiming a precise real-world scale. For street mode, use third-person or adjustable camera, click-to-walk, keyboard movement and touch controls. Nearby venues should have reachable entrances and clear interaction range. Static colliders prevent walking through buildings; road crossings and vehicles should read visually. Ambient pedestrians are labelled fictional/NPC in interaction menus.

Vehicle catalogue supports purchase, garage capacity, test drive, negotiation, condition, fuel, insurance and resale. **OBSERVED SOURCE:** up to ten vehicles, resale around 60% of list price. London's classes include bicycle, scooter, used compact car, family car, electric saloon, luxury car and performance car. Expensive vehicles provide status/comfort but should not make every public journey irrational.

Within Greater London is the primary world. Intercity UK routes can be a later content expansion while preserving a city-aware data model. Choose the destinations explicitly rather than silently copying Lagos–Abuja–PH route names.

## 15. Wallet, bank, tax and recurring obligations

**OBSERVED SOURCE:** cash wallet, savings, seven-day bonds, money history, weekly bills and separate job/business tax accumulators. Savings accrue 0.5% per week by the minute, credited once daily on the first ₦1 billion, with a ₦1,000 minimum. Bonds advertise 2% in seven days. Source tax: first ₦1 million per week exempt, then 20%, 30% above ₦10 million and 35% above ₦50 million; job wages use their own band separate from business income. Bets, asset sales and gifts are excluded by the displayed rules.

**LONDON REQUIREMENT:** use integer pence for all monetary amounts, with explicit rounding. Ledger entries contain transaction id, owner, source/category, gross, fees/tax, net, time, counterpart where relevant and resulting balances. Never rely on an editable client balance. Cash, savings, bonds, escrow, business tills, tax and prepaid purchased-currency balances are distinct accounts when they have different rules.

Bank UI: balances and net worth → deposit/withdraw amount → clear source/destination → confirmation → receipt/history. Minimums, available cash and lockup dates are visible. Deposit and withdrawal cannot create money through concurrent tabs. Mature a bond once; distinguish early redemption if supported from ordinary withdrawal. Savings interest settlements have a unique period key and eligible-balance cap.

Do not present the source's tax bands as real UK tax law. London's fictional bands and rates are DESIGN DEFAULTS until the economy is balanced. Preserve the useful game distinction between wages and business income if adopted, and explain it in the bank. Tax is withheld when income posts, using the correct cumulative period and marginal brackets, not by applying the highest rate to all past income.

Bills are due-item records with period, home/staff/policy, amount, subsidy, paid/lapsed/arrears status and receipt. Settle each bill once even if two devices wake at the due time. Define a consistent priority if funds cannot cover all obligations. Insurance can lapse; rent may produce a visible bill balance and recovery route; staff may stop service. Do not invent an unlimited overdraft without explaining it.

Transfers and requests belong in player chats. A request does not move money; acceptance does. Confirm recipient, amount and category. Incoming gifts alone must not be treated as evidence of game crime. Net worth includes the declared asset values and subtracts obligations; leaderboard totals must match the profile. The source's displayed wealth may have caps or cohort price tables that have not been established; never infer their exact internal implementation.

Monetisation remains an OPEN PRODUCT DECISION. The source supports buying game currency and states there is no real-bank cash-out. Claude must not add real-money checkout merely because a wallet exists. If later authorised, keep paid currency provenance and refund handling separate from earnable game funds.

## 16. Business ownership, player companies and commerce

**OBSERVED SOURCE:** the Invest app sells fixed businesses with advertised daily net-income ranges after running costs. Eight tiers run from a ₦150,000 recharge kiosk earning ₦700–₦3,200/day to a ₦250 million 5% club share earning ₦645,000–₦2.4 million/day. Other tiers are drinks stand, POS stand, food shop, salon, car wash and event centre. Settlement is every evening at 18:00, with good and bad days. These are distinct from a player-operated Company and its Player shop.

The Company flow is industry → original company name/logo → city/district → setup cost plus ₦50,000 registration → management. The observed eight industries are food, salon, provisions, fashion, pharmacy, events, dispatch and technology. Location changes cost and earning potential. For example, a source food company costs ₦90,000 setup in cheaper areas, ₦150,000 in Yaba and ₦450,000 in top-priced areas, plus the registration fee. Company management after registration was gated and not played. The public Shops directory visibly supports type, city, near-me, top and new filters; listings show owner, rating, open/service status and starting prices.

**LONDON REQUIREMENT:** preserve three separate concepts: (1) an owned passive business asset; (2) an operating company with premises, staff, pricing and accounts; (3) a public storefront from which actual players order. A static "buy café" button must not impersonate all three. Suggested original London tiers are a repair kiosk, coffee cart, corner shop, neighbourhood café, salon, detailing garage, event venue and nightlife investment. The names, branding and balances are original fictional content.

A passive business definition needs purchase cost, district, operating-cost model, demand distribution, weather/news sensitivity, condition, insurance eligibility, resale rules and payout calendar. A daily result stores gross sales, costs, disruption, insurance offset, tax and final credit. Display an earnings statement; distinguish a forecast range from a guaranteed return. Seed each period outcome once. Refreshing cannot reroll a bad day, and opening the app must not cause an extra settlement.

A company instance needs owner, name, moderated description/logo, industry, address, premises tier, opening status, staff roster, wage commitments, working capital, inventory, service capacity, prices, reputation and ledger. Registration validates total cost and name before deducting once. Explain whether the player can own multiple companies, change industries, sell or close; these are OPEN SOURCE QUESTIONS, so London must define them before implementing unlimited duplication.

**DESIGN DEFAULT:** use separate simulated walk-in demand and real-player orders. A base demand multiplied by location, price competitiveness, staffing, reputation, weather and news produces walk-in sales, bounded by capacity and stock. Each factor has documented caps. Rates and quantities are data-driven. Never create an apparent real customer, chat or review to represent a simulated walk-in.

Commerce flow: browse → listing → item/service details → quantity → item total, delivery fee and location eligibility → purchase → order tracking → delivery/collection → receipt → optional verified-order rating. For goods, inventory reservation and wallet debit are atomic; two buyers cannot both purchase the last unit. The seller receives the declared net amount once at the chosen fulfilment point. Failed delivery has a defined retry/refund state; no money vanishes when a player disconnects. For time-based services, show scheduling, capacity and cancellation terms before payment.

The owner console provides catalogue, stock/restock, pricing, staff, open/closed toggle, orders, money history and daily reports. Pharmacy merchandise only affects fictional game illness. Clothing products produce owned wardrobe entries; food produces consumable meal entries; dispatch products create deliveries rather than immediate generic mood points. Reconcile shop proceeds with company income so the same order is never counted again as a walk-in.

**Acceptance:** create a food company; reopen it after logout; stock three meals; sell one to a second test account; verify buyer food, seller inventory and both receipts; race two purchases for the last meal; settle the evening batch twice; verify one payout. Close the shop and verify catalogue remains visible while ordering clearly stops.

## 17. Land, construction, investment housing and transport fleets

**OBSERVED SOURCE:** six land products range from ₦250,000 quarter-plot land to ₦150 million waterfront land. Advertised appreciation is 1.9%–5% per week; some cheaper titles have land-claim risk while properly documented plots are marked safer. Bare plots are capped at 20. Building is staged and visible player work includes foundation, walls, roof, wiring/plumbing and finishing. Investment homes are capped at five and are not priced like the residence catalogue.

**LONDON REQUIREMENT:** use fictional development parcels, leasehold/freehold game labels or planning complexity without presenting a real property investment simulator. Model the parcel, title status, development state and resulting building separately. Construction graph: acquired → design approved → foundation → structure → roof → services → finish → inspection → usable. Each stage has prerequisites, materials, fee, time and optional hired player contract. One completed stage unlocks the next; duplicate submissions cannot complete two stages or refund spent materials.

Ownership and value persist regardless of the selected screen. Appreciation is computed from settled periods with an explicit cap and market events; valuation is not spendable cash. Sale previews the exact proceeds and outstanding obligations. A listed property cannot simultaneously transfer to two purchasers, collect new rent and be demolished. Define what happens to tenants, furniture, staff and active contracts before sale or conversion. The visible source does not establish these edge-case policies.

The landlord loop is purchase/build → list tenancy → tenant applies/accepts → lease begins → periodic rent → maintenance → expiry/renewal. Source listings advertise one-to-four-week terms and approximately 70% of ordinary rent. London needs a lease record with landlord, tenant, dates, rent, deposit, payment status and access. Owners cannot eject a paying tenant solely by changing the live home pointer. A lease and a player's current residence are different records.

**OBSERVED SOURCE:** Bus Co registration costs ₦2 million. A source HiAce costs ₦18 million, seats 14, and the calculator for a ₦22,000 Lagos–Abuja fare estimates about ten walk-ins/night, ₦751,000 weekly cash, 24-week payback and ₦90,000 weekly value loss. Fridays and Sundays are busier, traffic lowers income, crews are paid Saturday at 09:00 and walk-ins settle at 18:00. Coach and sleeper classes and three city-pair routes are exposed. These displayed estimates are source evidence, not proven underlying formulas.

London adaptation: a fictional coach/transport company with route, vehicle class, seats, fare, crew, operating costs, condition and timetable. If UK intercity content is adopted, start with a small explicitly designed destination set; do not pretend a route selector alone creates those playable cities. Route demand responds to fare and competing supply. Real passenger bookings must reserve a seat and create a journey linked to that departure. Simulated walk-ins fill remaining seats, never oversell beyond capacity.

**OBSERVED SOURCE:** a haulage trailer costs ₦18 million, earns ₦117,000–₦209,000/day before a ₦30,000 driver cost, can break down with a ₦95,000 repair, and resells for ₦11 million. London haulage remains a separate fleet asset class rather than a passenger-car upgrade. Show revenue, wages, maintenance and depreciation separately. A broken vehicle cannot keep earning the normal healthy payout while awaiting repair.

**Acceptance:** enforce plot and home caps under simultaneous purchases; complete one construction stage through a contractor; resume after reconnect; sell a fleet asset after a pending settlement and verify no double income. Compare the fleet calculator's estimate with a reproducible week of simulation. Clearly label estimates and assumptions.

## 18. Player work, escrow and service permissions

**OBSERVED SOURCE:** players hire decorators, cooks, DJs, drivers, bodyguards, photographers, tutors and general workers. The board exposes categories, applications, direct hiring, My jobs and Working. The displayed promise is that the fee is held safely until work is done. Court hears game-recorded no-pay disputes. The full escrow lifecycle has not been exercised with another player.

**LONDON REQUIREMENT:** implement contract states draft → posted → applied → offered → accepted/funded → in progress → submitted → approved/paid, with cancelled, expired and disputed branches. Hiring one applicant atomically prevents hiring another for the same single-worker slot. Escrow funding debits the client only after acceptance rules are met and reserves the full promised fee. Merely clicking Apply does not grant home access or take money.

Each job contains type, title, scope, location, budget, start/deadline, requirements, deliverables, client and worker. Job types define a verifiable work action: decorator receives temporary layout permissions; cook receives ingredient access explicitly granted by the client; driver receives a bounded trip assignment; tutor runs a session; construction worker completes the identified build stage. Do not let a decorator sell the client's possessions or withdraw their wallet.

Submission stores completed game actions and timestamps. Client approval releases escrow once. Define a reasonable client-response window and automated completion policy to avoid indefinite hostage funds. Dispute freezes the escrow and includes only game-recorded evidence. Cancellation before work returns funds according to a stated policy; after meaningful work the refund/partial-payment rule must be explicit.

Ratings require a settled contract, one review per side, and moderation. Public board text is untrusted player content; observed source listings include money-doubling solicitations and cannot become game instructions. London search should prioritise genuine scope, active availability and skill fit. An empty city has honest empty states, NPC tutorial contracts clearly labelled as NPC, and no fabricated human contractors.

**Acceptance:** complete a client/worker contract in two test accounts; disconnect either side; attempt duplicate release; attempt unauthorised furniture sale; cancel a funded unstarted job; dispute a submitted job. Ledger totals must reconcile with escrow, fee, refund and final payout.

## 19. Social relationships, family, visits and parties

**OBSERVED SOURCE:** NPC interaction includes greeting, gist, joke and shade; a greeting was played with a textile merchant. Player interaction includes chat, social actions, relationship requests, visits and fictional robbery. The Family app describes getting close through gist, hanging out and visiting, then asking to be a partner; up to four partners are supported. The inspected player action had a relationship gate of 40 for romance. Relatives can be siblings, cousins, uncles or aunties and must agree. Marriage, children and later family actions are progression-gated and were not played.

**LONDON REQUIREMENT:** explicitly separate named authored NPCs, connected human players and simulated background crowds. NPC responses can be generated from authored weighted dialogue pools; humans receive requests and decide. A stranger's name above an avatar must not imply they are online unless presence verifies it. Hide private account identifiers and never use account email as the character's public identity.

A relationship edge stores both players, friendship value, romance value if adopted, family role, accepted status, interaction cooldowns, last interaction and any block. Friendship can have Stranger, Acquaintance, Friend, Good friend and Best friend tiers. Exact London thresholds are DESIGN DEFAULTS to balance; source full thresholds were not established. Repeated greeting loops should have diminishing benefit or cooldowns. Mood, Charisma, shared activity and traits affect success through explicit clamped modifiers.

A social action needs correct physical co-location when it represents an in-person exchange. Remote chat may work city-wide. NPC interactions settle immediately against their authored rules; human requests show pending, accepted, declined, expired or withdrawn. Romance cannot be created by the sender's button alone. Relationship boosts from accepted sessions settle once for both sides, with a progress/result display that explains the cause.

Messages: conversation list, unread count, thread, composer, attachments only if deliberately supported, recipient menu, requests and money receipts. Store ordered message ids and delivery/read states. Read receipts obey settings. Block stops new contact and pending requests and removes access invitations. Report records context for moderation. A failed connection preserves the typed draft and distinguishes unsent from sent; retries must not duplicate messages or transfers.

Family requests disclose the proposed fictional role and require the recipient's acceptance. Ending a role, partnership or marriage must have a clear reversible UI where feasible and predictable effects on shared property, children and invitations. A household membership is distinct from a romantic relationship. **DESIGN DEFAULT:** child characters are authored non-player household members with care needs; adult players control them only through household roles. Define parenting consent, who pays care costs and who can hire a nanny before this feature ships. Do not invent an already played source pregnancy/child system.

Housing visits: owner invites → guest receives link/in-app request → journey → doorstep → owner admission/permission → bounded visit → leave/end. Source house guides expose an invitation link and real guests, with a visible guest cap of eight in the inspected flow. A link does not grant indefinite editing permission. Owner can revoke, kick or end the event; expired invites show why. Public visibility and private invite scope are separate controls.

The source explicitly describes buying Party Speakers, tapping them to Throw a House Party, and sharing the invitation through Phone → Invite. London party state includes host, home, time, theme, music, invite policy, capacity, guests and scheduled finish. Speakers drive an actual party interaction; DJs can be hired through contracts. Food, dancing, socialising and household facilities are available only with host permissions. Capacity checks reserve a slot atomically and late arrivals see a graceful full-house state.

**Acceptance:** two adults form and decline requests; prove a sender cannot accept for a recipient; block during a pending invitation; visit and leave a real friend's home; test the ninth guest; revoke the link; reconnect during a party. Guests cannot read private owner messages, buy with owner money, sell furniture or access household controls.

## 20. Reputation, daily missions, wishes, ambitions and perks

**OBSERVED SOURCE:** the daily panel contains reputation XP/level/title, login streak and seven-day rewards, three mission categories, one free swap/day, claim buttons and an all-three bonus. In the tested cohort: cook once gives ₦3,000 +20 Rep; take public transport twice gives ₦6,000 +35 Rep; buy furniture gives ₦10,000 +50 Rep. All three gives ₦15,000 +2 stars +80 Rep. Day-one check-in gives ₦5,000 +10 Rep. The panel started at JJC level 1 and labels Correct Person at level 3. Source wording says rewards follow the player's price table; cohort scaling rules are unknown.

**LONDON REQUIREMENT:** progression needs one authoritative event stream, not per-screen counter increments. A mission records definition, assigned day, target, current progress, relevant event ids, completion time and reward claim time. Purchasing and returning the same furniture repeatedly must not farm the same eligible purchase if the design forbids it. View-only previews do not count as visits; arrived journeys do. Public-transport count follows settled journeys rather than map taps. Catch-up after disconnect processes the same event ids once.

Mission assignment samples attainable tasks from Easy, Explore and Enterprise pools using current unlocks. A poor starter should not get "buy a mansion" as today's accessible mission. Show the unmet prerequisite before swap. A daily swap is atomic and does not restore a previously claimed reward. Midnight expiry preserves the receipt and historical progress; an unclaimed completed mission's grace policy is a DESIGN DECISION and must be displayed. Streak handling must specify whether missing a day resets or pauses. Seven-day reward values are configurable, with one claim per calendar day.

Reputation is distinct from friendship, skill XP and spendable stars. Original London titles could be New Arrival, Local, Familiar Face, Borough Favourite, City Insider and London Legend. Exact thresholds and payouts are proposed game balances. Levels should unlock visible content or cosmetics rather than silently inflating every price. Profile shows current XP and next meaningful unlock.

Source wishes expose up to three small personal goals, such as party at a named venue, earn a daily amount, or walk a landmark, rewarding three or four stars. London wishes are refreshed from feasible desire pools and track real qualifying events. Ambitions are long-term journeys with milestone progress; source allows changing the chosen ambition once a week. Preserve a cooldown and explain what carries over on change. Claim each milestone once.

**OBSERVED SOURCE PERK TABLE:**

| Perk effect | Star cost |
|---|---|
| Hunger decay −25% | 8 |
| Bladder decay −30% | 6 |
| Energy decay −25% | 8 |
| Fun decay −25% | 8 |
| Social success +15% | 10 |
| Work performance gain +25% | 12 |
| Buy-mode discount 10% | 10 |
| All skill growth +20% | 14 |
| Hygiene decay −25% | 16 |
| Social decay −25% | 16 |
| Sleep recovery +30% | 18 |
| Jail duration −25% | 20 |
| Flirt/romance success +15% | 20 |
| Good-mood duration +50% | 25 |

Source names use Lagos idiom; London names and icons should be original.

Perk purchase spends stars once and stores ownership. Discount applies to eligible furniture catalogue totals with rounding, never to arbitrary transfers or its own star price. Faster learning multiplies XP, not the skill level directly. Decay modifiers apply to rates, not instantaneous need values. Social bonuses add according to a documented probability model and clamp at the allowed maximum. No perk bypasses recipient consent. Define which categories stack with traits and whether a perk can ever be refunded.

**Acceptance:** finish a mission while the panel is closed; claim from two tabs; swap once across midnight; reconnect with pending completion; apply two decay perks and compare elapsed-time settlement; buy a perk twice; change ambition before and after its cooldown.

## 21. Branching stories and the daily city treasure

**PLAYED SOURCE:** Owambe Gatecrasher is a five-step story begun from the daily goals panel. It directs travel to Balogun Market, offers a paid outfit route, advances to a wedding at Eko Hotels, presents social/risky entrance choices and then an ending decision. We bought the ₦25,000 outfit, used a risky "London cousin" entrance that succeeded, and completed a dancing ending worth +70 Rep. The advertised maximum was +140 Rep and +2 stars; this chosen ending did not earn the maximum. This is direct evidence of branching costs, travel requirements, outcomes and variable rewards.

**OBSERVED SOURCE:** the other story families are The Lost Bag, Shrine Open Mic, Match Day Wahala, Pitch Night at CcHub and a wealthy-player Big Man Night requiring ₦1 billion net worth. Maximum displayed rewards range from +110 to +300 Rep and +1 to +4 stars. Only one was played through; exact other branches and probabilities remain open.

**LONDON REQUIREMENT:** story definitions are authored graphs, not a fixed sequence of generic modal questions. A node contains location requirement, text, choices, skill/trait/item/money gates, effects, chance rules, next node and ending. Run state stores story/version, current node, choices, one-time costs, chance seed/results and rewards. Start, leave, resume, fail and complete are explicit. A retry policy must prevent repeatedly farming the same ending reward.

Travel is part of the story. The "Go" button opens a journey to the required place. Reaching the venue satisfies arrival but does not silently choose an outfit, pay a bribe or accept a job. A locked choice explains its skill requirement; an unaffordable choice offers an alternate route. Roll probability once on the server, persist the result and show a useful consequence. Reload must neither refund a chosen fee nor reroll a failed social check.

Original London story briefs:

1. **The Guest List:** find an outfit at a market, reach a rooftop launch, choose honest networking, a friend introduction or risky bluff, then perform/help/connect; endings vary in reputation, stars and new NPC contact.
2. **Lost on the Night Bus:** discover a bag, trace its owner through a café and station, choose return/keep/report, and resolve with a lasting trust or game-crime flag.
3. **Open Mic in Camden:** practise at home, sign up, choose music/comedy/poetry, manage a stage interruption and earn audience response from skill plus a bounded chance.
4. **Derby Day:** travel to a pub, negotiate a seat without fictional extortion being the only route, join a quiz or crowd song, handle a rivalry and finish with social/Fun gains.
5. **The Five-Minute Pitch:** develop a prototype at a workspace, choose evidence or hype, answer two meaningful investor questions, and unlock a company opportunity rather than an unearned instant fortune.
6. **After Hours:** late-game members' event with a visible wealth/reputation gate, costly optional luxury choices and several prestige outcomes.

For each brief Claude must produce five-to-eight authored nodes, at least two meaningfully different endings, one skill route, one affordable route, persistent consequences and complete text. Track one active main story as a source-faithful default; pending chapters remain visible. Changing the view or closing the story panel is not abandonment. "Leave story" clearly states lost progress and any non-refundable spent resources.

**OBSERVED SOURCE treasure:** one daily clue points to a physical venue where a gem sparkles. First claim receives ₦50,000; second–third ₦25,000; fourth–tenth ₦10,000; later claims ₦3,000. The source shows claim count and first finders. The clue inspected referred to the canopy walk; the gem itself was not claimed in this study.

London treasure needs an authored clue pool, target venue/anchor, daily reset time and atomic global claim order. Require actual arrival and interaction; map inspection is insufficient. Players see the same daily target in a shared city, or the UI clearly labels city-specific variants. Assign rank and credit reward in one transaction. A disconnected animation can replay, but the prize cannot be paid again. Accessible text or audio cues must expose the collectible without requiring a tiny sparkling pixel.

**Acceptance:** leave a story panel halfway, reload, resume at the same node; fail and reload a random gate; spend the same choice twice; complete two different endings in separate clean accounts. Race eleven treasure claims and verify the published reward bands and exactly eleven receipts.

## 22. Real-time games, pub tables and spectator mode

**OBSERVED SOURCE:** five games are offered against real players: 8-Ball Pool, Ayo Olopon, Whot, Ludo and Chess. Pool, Ayo and Chess are two-player; Whot and Ludo expose two-to-four seats. Tables are attached to venues and shown as joinable or watchable. Friendly play costs nothing. The source stake presets are ₦1,000, ₦5,000, ₦20,000, ₦50,000, ₦100,000, ₦500,000, ₦1 million, ₦5 million and ₦10 million, plus a custom amount. The winner takes the pot less 5%; draws return stakes. Two missed turns in succession or leaving forfeits. Multi-seat lobbies start when all seats fill or when the creator starts with at least two. Eliminated players' stakes stay in the pot.

Chess specifically offers 1, 3, 3+2, 5, 10 and 30 minutes per player for the entire game. The 3+2 option adds two seconds per move. White goes first. Running out of time loses, except a draw if the opponent cannot checkmate; leaving loses too. These were inspected in the create form, not played as a participant.

**SPECTATED SOURCE:** pool uses a full-screen dark interface with a vertical six-pocket felt table, wood rails, live balls, two player cards, remaining solid/stripe indicators, active-player highlight, turn countdown, pot/venue and short outcome commentary. Ayo shows two six-pit rows, stores, seed counts, current player and timer. The visible rule is anticlockwise sowing and capture when the final seed leaves two or three seeds in the opponent's pit; the lobby says first to 25. Whot shows market/discard cards, participant hand counts and a winner overlay; spectators explicitly cannot see hidden hands. Closing a spectator board leaves the match running. No stake was placed and no human match was joined for this inspection.

**LONDON REQUIREMENT:** pub-table games are complete subgames with a real lobby, legal moves, turn progression, terminal outcomes, reconnect and spectator state. Preserve pool, chess and Ludo; keep Ayo and Whot as games London communities actually enjoy within our fictional world, or add darts and a pub quiz as original expansions. Replacement choices are product decisions, not permission to silently drop five-game scope. Darts requires its own aim/scoring rules; a quiz is not a reskinned card board.

Common table states: open → filling → ready → active → finished → settled, with cancelled/expired before start. Store game definition/version, venue, creator, seat capacity, accepted seats, rules preset, friendly/stake setting, escrow accounts, start time, turn index, state version, deadline, consecutive misses, results and settlement id. Joining reserves funds and a seat atomically; the final two simultaneous join attempts cannot occupy one seat. Leaving an unstarted table returns any reserved stake under the visible policy. Leaving an active game follows its stated forfeit rule.

Server validates every move against player, current turn, version and deadline. Use ordered move events and reconnect snapshots. Never accept a client-supplied winner, dice roll, shuffled deck, score or payout. Ayo/Ludo/card random seeds are protected on the server and cannot be exposed through public state. Spectators receive public state only; hidden cards must be omitted from the payload rather than merely concealed with CSS. Players receive their own hand privately.

Pool needs a deterministic shot model or server-validated authoritative physics: bounded direction/power, cue-ball state, collision/pocket results, turn assignment, group assignment, scratch/foul handling, legal black-ball finish and final winner. Exact source physics/foul variants were not established. London must publish one ruleset in the table before joining. Touch aim/power controls and keyboard alternatives should yield the same shot command. Animation does not determine the result independently on each client.

Chess requires legal move generation, king safety, check/checkmate, stalemate, castling rights, en passant, promotion selection, draw conditions, resignation and server clock accounting. Clock decrements only the active player's elapsed time; reconnect cannot restore time. Draw-by-agreement requires both players. Use a maintained rules library and verify its legal edge cases; do not generate visually plausible moves without enforcing rules.

Ludo needs four tokens per participant, entry roll, movement track, safe squares, captures, home path, exact finish, bonus rolls and consecutive-six policy. Source detail beyond "roll six, race all four home" was not verified. Ayo needs sowing, capture chain, starvation/feeding rules, endgame collection and draw policy; the last three are unverified source details. Whot needs a finite deck, shape/number matching, special-card effects, market exhaustion, called shape, finishing declaration and stacking policy. Author a published preset rather than claiming every regional house rule is the same.

Turn games use a visible server deadline and two consecutive misses as the source-faithful default; a valid move resets misses. Define automatic actions on a first miss per game. Network loss alone should show reconnecting and the remaining deadline, not immediately invent a resignation. Spectators can close without forfeiting anyone. An eliminated participant can spectate without receiving opponents' private information.

Friendly games should be available from the first playable release. **OPEN PRODUCT DECISION:** whether London includes fictional-currency stakes and casino mechanics. Documented source features remain in scope planning, but Claude must not introduce real-money wagering, cash-out or a payment dependency. If fictional stakes are adopted, debit all stakes to escrow at start, settle a single result, round the house fee consistently and refund a draw once. A result receipt shows pot, fee and net, not two contradictory "winner takes" totals.

Hall of Fame and venue boards expose games played, wins, win rate, best pot and the inclusion rule; source counts money-game wins and asks for a minimum ₦1,000 game to appear. London can have separate friendly/ranked boards to avoid forcing stakes. Use server aggregates, distinguish all-time/season/venue and cache with a visible update interval. Investigate implausible win trading rather than letting two accounts indefinitely farm rankings and net worth.

**Acceptance:** simultaneous seat joins; creator leaves before start; every game reaches a legitimate finish; draw refunds; two consecutive misses; clock expiry; disconnect/reconnect; one hidden hand never appears in spectator data; duplicate finalisation; cancelled lobby refund; a spectator closing has no game-state effect.

## 23. Optional casino and shared sports predictions

**OBSERVED SOURCE:** LagosBet exposes football prediction slips, high-low and roulette. Daily fictional match listings show home/draw/away odds, a combined-picks slip, preset stakes of ₦500/₦2,000/₦10,000/₦50,000 and results at 21:00 for everyone. The source explicitly labels 18+, game money only, no withdrawal and house edge. The inspected pairings were unusual cross-league fixtures; their relationship to actual sport was not verified. No bets were submitted.

**DESIGN DECISION:** decide whether these belong in London's tone and economy before implementation. If included, use clearly fictional fixtures and currency, explain odds and cost, cap exposure, and make games of skill and free social play equally visible. Do not fetch or claim real sporting results without designing an actual data integration. Casino content is optional and cannot become the only reasonable path from a low-income origin.

A prediction slip records fixture/version, selections, odds locked at submission, stake, potential return, cutoff, result and settlement. A fixture cannot change its outcome because a late user logs in. Shared fixtures settle once after their cutoff. No bets after the result is known. Roulette/high-low need server-generated outcomes, explicit pay tables, draw/tie rules and a round receipt. Restarting or replaying a losing animation cannot reroll the wager. This is a scoped future subsystem, not a decorative Place Bet button that only increases a wallet.

## 24. Weather, condition, insurance and recovery

**OBSERVED SOURCE:** Assurance contains six cover classes: home, possessions, vehicle, health, business and investments. Weekly premiums are priced on Saturday using the forthcoming forecast and city news, charged with rent at 09:00. A premium that cannot be paid causes lapse. Source risks are probabilities of at least one event in the next seven days, not percentages applied every minute. The inspected profile forecast had three rainy days and showed flood 9.3%, storm 3.6%, burglary 5.5%, home fire 2.8%, phone snatching 2.8%, medical 2.1%, car break-in 2.8% and drive accident below 1%. These values depend on the inspected home and are not general London probabilities.

Source home condition includes wiring, roof, drains and security. Condition below 60% raises some risks. Hazards are separated by a few days. Rain is required for flood/storm. The source states uninsured bad luck does not put a small earner under ₦2 million in debt: unaffordable excess loss is forgiven. Exact hazard sampling, excess and indemnity formulas were not exposed.

**LONDON REQUIREMENT:** weather belongs to the world state and should affect journeys, venue attendance, warmth, outfit comfort and some business demand. Use an authored stochastic fictional London forecast unless a deliberate live-weather integration is added. HUD shows current weather; forecast screen shows daily conditions. Rain should be readable through wet pavement, umbrellas, glass droplets, soft reflections and sound, with a reduced-effects mode. Season and daylight are presentation/configuration decisions, not uncontrolled browser clock changes.

Risk and insurance model: compute a period snapshot from home district, owned assets, condition, activity exposure, forecast/news and protection. Keep severity, frequency and deductible separate. Show cover, premium, due date, exclusions, excess, estimated risk and repair options before purchase. Policy states quoted → active → due → renewed/lapsed/cancelled. A policy purchased after an event cannot retroactively cover it. Do not pay an insurance claim twice when a repair screen is reopened.

Each hazard records cause, event time, affected item/home/car/business, condition before/after, assessed loss, policy snapshot, payout, player share, hardship relief and repair state. One event can damage multiple assets but must not count as multiple independent premiums or duplicate penalties. Business-interruption cover reduces eligible lost takings rather than arbitrarily adding the full purchase value. Repairs consume a visible amount/time and restore a defined condition value.

**DESIGN DEFAULT:** protect low-income players from cascading irreversible failure through capped uncovered loss, basic free recovery and clearly explained temporary inconvenience. The source threshold cannot simply be converted from naira to pounds. Balance the London threshold relative to the starter weekly wage. A player should never be permanently stranded without food, a basic bed or a way to earn. Purchased cosmetics/currency require provenance protection if monetisation is later approved.

**Acceptance:** premiums across midnight/week rollover; insufficient funds lapse; event immediately before/after purchase; repeated claim submission; broken car without insurance; condition below threshold; non-rainy flood prevention; newcomer hardship relief; reconnect during repairs. Verify forecast probabilities are not sampled repeatedly once per UI render.

## 25. City government and weekly elections

**OBSERVED SOURCE:** Governor, Senator and President races run weekly, ending Sunday at 20:00. Accounts must be one day old to vote or run. Candidate entries show manifesto, live votes/share and optional campaign manager. The Governor appoints Finance, Works, Health and Transport commissioners; one visible policy increases every shift wage by 15%. Campaign fees are ₦50,000 for Governor/Senator and ₦100,000 for President. Daily allowances are respectively ₦25,000, ₦15,000 and ₦25,000. Voting happens in person at the Polling Unit through accreditation and one ballot per race. We inspected the races but did not register, campaign or vote.

**LONDON ADAPTATION:** use a fictional London Mayor and Borough Representative. A national prestige office is a future product choice if other UK cities become playable. Do not relabel a Lagos President as London's actual constitutional office. Weekly terms and game policies are intentionally fictional. Roles are earned by game ballots and confer bounded simulation powers, never moderation access, another player's private data or unrestricted money creation.

Election state: scheduled → nomination → campaign/voting → closed → certified → term active → ended. Store district, office, term id, cutoff, eligibility version, candidates and immutable ballot records. Running checks account age, district, fee, candidate slot and text moderation. Voting checks age, accreditation, current race, arrival at the polling venue and no existing ballot. The published rule must say whether a vote can be changed before cutoff; default is one final ballot.

At cutoff, count once, apply documented tie-breaks, certify winner, activate the new term and end old permissions/policy. A ballot received after the server cutoff cannot win by browser clock skew. If no candidate runs, use a clearly labelled caretaker NPC and neutral policy. If a winner becomes ineligible, define succession rather than letting a broken account freeze the city.

Policy catalogue uses bounded modifiers such as transport fare relief, community-class discount, wage uplift or public-space upkeep. Each policy records scope, budget/cap, start/end and beneficiary rules. Wages already settled do not get retroactive duplicate uplift. Appointments require recipient acceptance and expire with the term. Announcements appear as civic posts with office attribution; spam limits still apply. Candidate promises in free text do not execute code or guarantee transfers.

**Acceptance:** new-account gates, double vote, district eligibility, tie result, zero-candidate race, late ballot, DST cutoff, term handover while two devices are online, expiry of appointed powers, duplicate allowance settlement. Display a ballot receipt without exposing another player's private vote.

## 26. Fictional game crime, custody and court

**OBSERVED SOURCE:** attempted robbery requires two players at the same place, is capped at ₦50,000 and the source says police catch most attempts. Crime reports increase the reported robber's risk. EFCC game investigation watches sudden wealth, large outgoing transfers, money passed through and past crimes; receiving a gift alone never opens a file and raids never take topped-up currency. The Court accepts only game-recorded robbery or player-work no-pay cases. The source exposes lawyers, live cases and custody activities such as food, a mat, exercise, cleaning and bail. We did not rob anyone, enter custody or conduct a trial.

**LONDON REQUIREMENT:** if retained, use fictional game police and an original Financial Investigation Unit with published game rules. Keep simulated crime separate from real harassment reports. Police UI explains the recorded event and available game remedies; moderation UI reports abusive player behaviour to platform staff. A user-authored accusation alone cannot confiscate another player's wallet or create a game conviction.

Crime attempt record contains participants, co-location proof, timestamp, bounded chance result, maximum available eligible funds, amount moved, detection result, victim receipt and consequences. Roll once and settle atomically. Purchased/protected funds remain excluded if monetisation exists. Limit frequency and newcomer targeting. Consent/privacy product rules for this mechanic are OPEN; do not let it dominate social play or provide an unchecked harassment loop.

Custody is a timed character state with sentence basis, start/end, available needs actions, lawyer/perk reduction and bail terms. Show a viable path through the timer. Prevent normal incompatible work/travel actions while incarcerated, but preserve account access, safety reports and communications permitted by the design. Sentence shortening applies once; repeatedly hiring/reopening a lawyer cannot shrink duration without limit.

Court case states filed → admissibility checked → lawyer selected → scheduled → hearing → decision → remedy → closed, with withdrawn/dismissed branches. A case references immutable game incident/contract ids, claimant and respondent. No manual free-text story can substitute for missing evidence. Lawyer fees are quoted and paid through an explicit service contract. Hearings can provide role-play dialogue, but monetary remedy is constrained by actual ledger evidence and published rules.

The record-based judge can be deterministic and NPC-led initially. Player judge powers, if added, require bounded remedies, conflict-of-interest rules and appeals; they are not established by source inspection. No real UK legal advice or representation is implied. Escrow disputes must coordinate with court so a remedy and ordinary contract approval cannot both pay the same worker.

**Acceptance:** reporting with no eligible event; gift alone produces no financial case; protected funds remain safe; duplicate robbery command; target departs before attempt; sentence expiry offline; perk reduction twice; a court decision and contract release race. Every financial consequence has a legible receipt and a recovery route.

## 27. Feed, rankings, ads, notifications and moderation

**OBSERVED SOURCE:** Lagos Gist accepts posts up to 280 characters, with latest, trending, following and own-post views, reactions, comments, profile badges and game achievement posts. Wealth rankings refresh roughly every one-to-two minutes; internal wealth caps were not established. Ads allow billboards at ₦250,000/seven days and sea plots at ₦500/plot/seven days, with images and clickable links. An external advertiser flow also exists. None was purchased or posted during study.

**LONDON REQUIREMENT:** an original city feed sits inside the phone, with authored civic/event posts and real player posts clearly distinguished. Limit composer length, preserve drafts, show sending/error states and deduplicate retried submissions. Automatic achievements require the player's sharing preference and are emitted once per milestone. Real-time comments/reactions have stable ids and pagination; trending weights are bounded and documented, not a random label.

Public profiles expose chosen name/avatar, career, visible home/vehicle prestige, reputation, public business and relationships according to privacy settings. Do not publish exact live physical location by default just because the server tracks it. "Here now" venue counts come from expiring presence, not all accounts ever created. Avoid inflated random visitor/online numbers; empty areas should still feel alive through explicitly NPC crowds.

Rankings need category-specific measures: net worth, reputation, career progress, company success and game results. Net worth uses declared valuation rules and excludes double-counting a residence also represented as an investment building. Transfers can move wealth between players but cannot create new aggregate wealth. Cached values show update time. New seasons and all-time totals are distinct. Rank fraud investigations cannot silently rewrite wallets based solely on leaderboard position.

Ad booking flow: choose eligible inventory/district → dates → image/text/destination preview → moderation validation → game-currency price → book → scheduled/live/expired dashboard. Ads expire from server time and open an external-link confirmation or clearly marked destination. Reject executable links and inappropriate content. In-world surfaces use London bus shelters, shop noticeboards and fictional station posters; do not reuse source sea-plot visuals as the only adaptation. Advertisers never gain user tracking data merely by renting a billboard.

Notifications are event-driven: course ready, journey arrival, shift complete, invitation, contract action, message, bill due, claim, story unlock and term result. Group repeats, preserve unread/read state across devices and deep-link to the relevant entity. Push/email are opt-in settings and can be disabled independently; critical in-app receipts still remain. Never use a browser permission prompt to block the first game action.

Moderation is a first-class service for public names, posts, ads, jobs, companies and chats. Players can block/report from a profile or message without searching a policy page. Preserve necessary contextual ids for review. Rate-limit unsolicited requests, transfers, campaign spam and repeated contact; enforce blocks at the server, not just in the feed UI. Content strings are rendered safely. Authored NPC dialogue is culturally specific but avoids making ethnicity, gender, religion or borough a deterministic criminal trait.

**Acceptance:** pagination without duplicate posts, failed-send retry, blocked sender, deletion visibility, report creation, ad start/expiry, invalid destination, privacy settings during active presence and ranking reconciliation with the bank ledger.

## 28. The visual identity of a beautiful London Life

**LONDON REQUIREMENT:** the world should feel like an inviting miniature London you want to inhabit: warm windows, layered brick streets, leafy squares, busy markets, quiet flats, rain-lit pavements and late-night music. Beauty comes from a coherent composition and meaningful places, not a skyline wallpaper behind menus. Every important purchase, outfit, venue and home improvement has a visible in-world result.

**OBSERVED SOURCE:** Lagos uses a tilted stylised 3D map, modular venues and many repeated houses, floating white venue pills, in-world billboards, a top time/mood/wallet bar, bottom-left avatar/need bars and four main navigation tabs. The broad city map, furnished home, venue interiors and a walkable neighbourhood are distinct modes. London's design keeps this understandable hierarchy while adding irregular street blocks, recognisable public space and neighbourhood variety.

**Art direction:** stylised 3D with carefully shaped silhouettes, soft bevels and selective texture detail. Moderate proportions should keep characters expressive and furniture readable on a phone. Use restrained materials: warm red/brown brick, cream stucco, dark iron, damp slate, honey oak, tiled shopfronts and painted doors. Avoid a uniform grid of identical cubes with one landmark dropped in the centre. Buildings can share a modular kit but vary roofline, depth, height, frontage, shop awning, balcony, window light and courtyard.

**Palette defaults:**

| Token | Hex | Use |
|---|---|---|
| Warm ivory | `#F4EEE4` | calm UI surfaces |
| Ink | `#17232B` | primary type |
| Deep bottle green | `#234C42` | primary controls |
| Bus red | `#BC3D3B` | small city accents |
| Gold | `#C69C58` | prestige/reward |
| Sky grey | `#B6C5D0` | sky |
| Wet slate | `#46505B` | slate/pavement |
| Brick | `#A45A45` | brick |

These are art defaults to test, not a requirement to use one flat colour everywhere. Needs use distinct shapes/icons as well as colour. Money gains, costs and disabled controls must retain contrast in daylight and dark scenes.

**Camera:** a comfortable three-quarter orthographic or low-perspective city view; borough selection smoothly frames the relevant cluster. Street camera follows behind/above the avatar with controlled rotation, collision and a recenter button. Home uses a cutaway/dollhouse camera with wall fade and adjustable zoom. Venue uses authored framing that keeps the character and primary interaction anchor visible. Do not allow buildings to occlude the player forever, or HUD sheets to cover every interaction on small screens.

**Lighting:** one consistent daylight model, soft contact shadows, ambient fill and warm interior lights. Morning feels pale and fresh; evening is golden around brick and windows; night uses selective pools of shop, pub and station light. Rain reduces sun contrast and adds restrained reflections rather than turning the scene black. Avoid excessive bloom, neon everywhere or unreadable dark interiors. Shadows and reflections have quality tiers. Time changes are smooth and based on server world time.

**Map composition:** a winding Thames as the main spatial spine, bridges linking districts, several recognisable skyline silhouettes, park masses, rail/station hubs and irregular street clusters. The map is a compressed game world, not a claim of survey accuracy. It should explain routes and place relationships at a glance. One landmark per borough cluster is enough; ordinary homes and local shops should receive equal craft. Public labels appear by importance and zoom, with search and an accessible list for every venue.

**Character direction:** a broad range of skin tones, body shapes, hairstyles, facial features and adult identities with coherent stylised topology. Rig supports idle, walk, jog, sit, sleep, eat, cook, shower privacy, dance, talk, wave, exercise, work and celebrate. Outfit slots include Everyday, Home, Sleep, Date, Party, Work and Gym. Separate meshes/material slots must avoid clipping across body variants. Hair, coats, scarves, trainers, formalwear, workwear and cultural dress are authored original assets. Winter layers and umbrella use reflect weather through comfort modifiers, not rigid assumptions about people.

**Animation** must communicate activity: a cook uses the hob; a sleeper lies on the owned bed; a reader sits with a book; a DJ uses a deck; a pool player aims; a worker sits or stands at the correct workstation. A floating progress bar with a motionless avatar is insufficient for core activities. Interaction positions are explicit asset anchors. Simulated ambient characters have cheaper animation and collision but distinct crowd identities.

**Homes** tell a personal story. Starter rooms are small but dignified, with a usable bed, basic food route and characterful light. Better homes add windows, storage, better footprints, outdoor space and visible facilities, not merely an increased text label. Style families can be warm vintage, compact modern, creative loft, family comfort and understated luxury. Furnishings share realistic scale and their footprint matches the model. Mirrors, windows and plants use restrained approximations on mobile.

**UI direction:** calm rounded surfaces, crisp type and compact icons; clear title, body and utility hierarchy. One consistent primary button per decision. Currency/duration/need impacts sit beside the action before commitment. Profile and phone feel like possessions inside the world. Large lists use well-spaced rows, filters and progressive detail. Toasts give a specific result, such as "Meal ready; hunger +28", not "Success!" for every action. Every paid or time-locked action has a receipt/history path.

**Sound:** original or licensed ambient layers for traffic, footsteps, rain, birds, station rumble, café chatter, pub murmur, park wind, kitchen, household appliances and club music. Scene transitions crossfade; distant sound is quieter, and UI rewards stay subtle. Music and effects have independent sliders, mute persists, and playback starts only after browser interaction. Do not embed unauthorised radio streams or popular tracks. A radio venue can host original loops and authored programme snippets until licensing is resolved.

**Quality bar:** review the same character on a wet street, in a starter flat, on a rooftop at dusk and inside a busy pub. All four should feel like one game. Fix scale, camera, silhouette, material and lighting consistency before adding dozens of decorative assets. A beautiful screenshot must still be playable: visible target, legible HUD, clear route and actionable controls.

## 29. Boroughs and the playable city structure

**DESIGN DEFAULT:** launch Greater London as one connected city with a deliberately compressed map. District clusters are Central/Soho, City/Shoreditch, Camden/King's Cross, South Bank, Brixton/Peckham, Greenwich/Canary Wharf and West London. These are content clusters rather than exact administrative boundaries. Each has homes, social life, earning/training and recovery options; the expensive central cluster must not hold every useful activity.

- **Central/Soho:** dense shopfronts, theatres, food lanes, a restrained members' venue and late-night streets.
- **City/Shoreditch:** office towers against older warehouses, startup workspace, creative studios, food halls and loft housing.
- **Camden/King's Cross:** canal edges, market texture, music rooms, education and a major rail gateway.
- **South Bank:** river promenade, theatre/culture, bridges, buskers and social lawns.
- **Brixton/Peckham:** lively markets, community venues, salons, rooftops and varied residential streets.
- **Greenwich/Canary Wharf:** river journeys, park viewpoints, maritime cues and finance workplaces.
- **West London:** leafy terraces, quieter gardens, premium housing and a distinct market square.

Each borough kit needs at least three building families, one public-space set, district sign/wayfinding style, a characteristic light/material mix, vegetation, local ambient sound and multiple NPC voices. Borough status is not a morality classification; all districts contain care, opportunity and wealthy/ordinary households. London humour comes from queues, flatmate politics, transport delays, weather, work and social ambition.

Three levels of play share one location model: city map for choosing destinations; street scene for physically walking through a neighbourhood; authored venue/home interior for activities. The same venue id connects all three. Approaching a door in street mode opens its entry affordance; a map route ends at that same entrance. No duplicate location ids that split presence, story checks and shop discovery.

World entry should load the current district/home quickly, then stream adjacent geometry. A newcomer sees an appealing local route rather than waiting for every borough and luxury interior to download. Keep inaccessible future cities clearly labelled; never render a "coming soon" button as successful travel. The initial London city still needs a complete core-loop route and the full documented feature architecture.

## 30. London venue catalogue and distinct activity spaces

**LONDON CONTENT DEFAULTS:** names below are original fictional game venues placed within a compressed London. They are not reviews, real bookings or promises of real opening hours. Every venue has a stable id, district, exterior/entrance, interior or public-space scene, interaction anchors, opening calendar, accessible directory entry, activity list, NPC roster, shops/presence and story hooks. Scheduled gates are visible before paying to travel. Each space must differ in both appearance and what it lets the player do.

**01 · Borough Street Market:** produce, fabric, second-hand and street-food stalls; buy recipe ingredients, browse vintage clothing, negotiate a décor find, assist a trader for pay, practise product photography, join market gossip and find a story outfit. Stall anchors and inventory matter. Trading tasks train Enterprise; bargaining depends on Charisma/Enterprise with bounded discounts. This replaces the source market function, including its distinct stalls rather than one generic "shop" button.

**02 · Common Table Food Hall:** affordable meals, shared tables and a visible kitchen. Eat named dishes, help wash/serve for wages, learn a recipe, chat with an authored cook, refill water, wash hands and play a friendly card game. Eating produces different Hunger gains, cooking instruction produces XP, serving produces a work result. Preserve an affordable meal option at all normal opening times.

**03 · Camden Backroom:** small live-music venue with stage, audience, green room and bar. Watch an original band, dance, rehearse, sign up for open mic, perform music/comedy, request a licensed/original track, meet an NPC musician and help set up. Show queue/slot and stage timer; a low-skill performance can be modestly received without automatically humiliating the character.

**04 · The Last Stop Pub:** cosy local with booths, screens, quiz area and courtyard. Watch a fictional derby, discuss football, join a pub quiz, buy food/soft drink, socialise, play Ludo/Whot and participate in an authored match-day story. Event calendar changes atmosphere. Friendly alternatives remain available alongside any optional stake games.

**05 · Chalk & Cushion:** pool hall with readable playable tables, benches and refreshments. Practise pool, create/join/watch a real match, play chess/Ayo, meet regular NPCs and view venue Hall of Fame. Practice has NPC/tutorial opponents explicitly labelled; multiplayer tables correspond to actual server sessions.

**06 · East Yard Workspace:** shared desks, meeting pods, prototype bench and demo stage. Practise Coding, repair a toy device, join a study sprint, prepare a pitch, present at a scheduled demo, network, use career boards and meet an NPC founder. Work requires the workstation anchor; certificates and tasks unlock company opportunities.

**07 · Riverside Arts House:** theatre, exhibition hall, performance courtyard and café. Watch a play/comedy set, perform spoken word, browse/buy original art, attend a sketch session, learn Photography, chill in the garden and play Ayo. Bought artwork becomes a placeable owned item rather than disappearing into a toast.

**08 · Borough Athletics:** gym floor, cardio area, studio, changing room and coach desk. Lift weights, run treadmill, take yoga, book an NPC coaching session, shower, drink a shake and apply for fitness work. Exercises have different Energy/Hygiene/Fitness effects; recovery and facilities remain accessible without a premium membership trap.

**09 · The City Office:** reception, working floors, meeting room and break kitchen. Begin eligible office shifts, attend briefing, complete career-specific tasks, socialise on break, use the kitchen/toilet and review performance. A selected career determines task data and workstation; the office cannot give all careers the same "answer email" sequence.

**10 · Afterlight:** dance club with floor, DJ booth, bar and VIP balcony. Dance, enter a skill battle, request a track, perform a booked DJ set, buy a round, reserve a table, take photos and network. Published night opening and last-entry rules. Luxury spend gives prestige/mood but does not beat a skilled dancer automatically.

**11 · The Hidden Chapter:** bookcase-entry cocktail venue with reading corner and small dance room. Find the authored entrance, read, converse, enjoy food/drink, request music, dance and lounge. Important source distinction: "The Library" is actually nightlife; London's educational library is a separate venue below.

**12 · Regent's Green:** paths, lawns, sheltered pavilion, pond edge and nature loop. Walk, jog, picnic, observe wildlife, rest, take photos and join a friendly outdoor fitness session. Weather affects comfort and availability. A nature activity is not travel to a Nigerian canopy with the label changed.

**13 · Crossway Arcade:** shops, grocery, cinema and food court. Buy ingredients, browse outfits, watch a film, eat, have dessert, window-shop and practise retail work. Cinema has screenings and a timed session; groceries and wardrobe purchases produce inventory. An optional fictional shoplifting branch requires the crime design to be approved as a product feature.

**14 · South Bank Promenade:** river path, busker pitch, steps, small stalls and bridge viewpoint. Walk, watch buskers, perform at a pitch, photograph skyline, play casual football in an appropriate game space, snack, meet friends and watch sunset. Keep river interaction to authored safe routes; swimming is not copied from the source beach by default.

**15 · Borough Health Centre:** reception, waiting area, fictional consultation room and game pharmacy. Check health, treat a game illness, buy a fictional recovery consumable, visit an NPC patient and volunteer. Queues and treatment are simulation content; no real diagnostic claims. Bills/insurance appear in the game ledger.

**16 · Crown & Curl:** inclusive hair/beauty salon with styling stations, barber chairs and nail area. Preview hair/braids/locs/cuts, confirm a style, get nails, share salon gossip, train through assistant work and hire a player stylist if supported. Paid appearance changes update the avatar mesh/style and wardrobe record immediately after settlement.

**17 · Skyline Kitchen:** original rooftop restaurant with dining room, terrace and musicians. Book a dinner for two, eat a tasting menu/dessert, toast, request an original instrumental dedication, watch skyline, photograph and conduct a consent-based date. Two-person dinner requires invited/accepted participant, not an invented romantic partner.

**18 · Community Chapel:** calm church/community room with music and conversation. Attend authored services, join choir, reflect, give a game-currency donation, help organise a community meal and talk with an NPC leader. Weekly calendar differentiates service types. Faith choices are voluntary and equivalent secular recovery exists.

**19 · Neighbourhood Mosque:** prayer/reflection space and community courtyard. Join an authored prayer/community event, use washing facilities, read, hear an NPC talk, donate game funds and help a food/community programme. Respectful dress/space presentation; no real religious achievement score or penalties for choosing another venue.

**20 · The Common Room:** secular community centre with noticeboard, workshop, shared meal area and games corner. Volunteer, meet neighbours, join a free skill group, access basic recovery, take a civic workshop, organise an event and play friendly games. This is the robust low-income recovery anchor, not a permanent "free money" exploit.

**21 · City FM House:** reception, studio, production booth and listening lounge. Listen to original programmes, practise presenting, rehearse a comedy segment, produce an audio task, request a track, tour and work broadcasting shifts. Sound consent/mute persists, and listening does not force external unlicensed streams.

**22 · City Hall & Polling Room:** public lobby, election desk, ballot booths and civic display. Check candidates, accredit, cast eligible ballots, attend a campaign talk, read policy effects and meet community NPCs. Candidate/appointment consoles depend on current office and term, not physical access alone.

**23 · The Thames House Hotel:** lobby, lounge stage, pool, buffet, spa and room corridor. Eat brunch/buffet, listen to the band, swim, book massage, photograph, take a timed room rest and rent a luxury suite. Room booking checks cost/dates/capacity and expires; hotel rest does not replace the active home record.

**24 · Northside Motors:** showroom, test route and service bay. Browse vehicles, inspect fuel/condition/upkeep, take a test drive, haggle under a defined rule, buy/sell and service. Preview models are separate from owned cars; driving permissions and journey fuel use follow ownership.

**25 · Riverlight Jetty:** boarding ramp and boat deck. Book a sunset cruise, take a daytime river journey, photograph, enjoy a snack, socialise on deck or charter a fictional private event. Ticketed scheduled departure and capacity are real records. Weather can suspend service with a clear refund policy.

**26 · The Members' Green:** fictional prestige sports/social club with course, clubhouse and terrace. Practise or play a golf session, take a lesson, converse, dine, network and hold a booked private event. Visible net-worth/reputation gate and affordable public alternatives. Networking offers opportunities rather than multiplying cash instantly.

**27 · City Justice Hall:** case desk, lawyer rooms, hearing room and public gallery. File an eligible recorded-game case, hire a lawyer, review evidence, attend hearing, spectate a public fictional case and claim an authorised remedy. Court controls remain distinct from real abuse reports.

**28 · London Learning Campus:** lecture hall, library, study courtyard, sports court, canteen, student housing and river/canal viewpoint. Attend a course, read notes, take its quiz, join tutorial/group study, practise a relevant skill, tutor, work food service, play five-a-side, jog, join student society, eat, rest in an eligible dorm, use facilities and photograph an event. Campus progression is deeper than one "study" action; source university had more than thirty activity entries across multiple spaces.

**29 · Still Room Wellness:** plants, tea station, circle seating, private NPC conversation and breathing area. Journal, take an authored breathing session, join a fictional group discussion or rest with tea. Effects are game mood/need recovery, not promises of clinical treatment; personal real-life disclosures are unnecessary.

**30 · Borough Stadium:** gates, stands, covered VIP section, hospitality box, concourse and training area. Buy event-specific tickets, watch a match/concert, chant, tour, buy a wearable scarf, eat, play a training challenge and practise penalties. Gates open before kickoff; ticket class controls seating/perks. Football and concert calendars are separate.

**31 · King's Cross Gateway:** ticket hall, concourse, platforms and café. Plan a district/public journey, view departures, use facilities, meet a traveller NPC, buy a snack, watch trains and initiate future intercity routes if those cities are implemented. A platform animation does not imply real timetable integration.

**32 · London Air Terminal:** check-in, departure lounge, food court and apron-view area. Work airport operations, book an implemented flight, relax, shop fictional duty-free goods, eat and watch planes. Aviation and airport careers stay distinct. Private-aircraft ownership is late-game scope with visible storage/upkeep; an airport alone does not complete it.

**33 · Borough Build Yard:** material supplier, planning desk and workshop. Buy construction materials, inspect a parcel/build plan, train a practical Enterprise skill, accept a construction contract and hire a worker. Build stages refer to the player's actual parcel and preserve completed work.

**34 · Public Reading Library:** quiet desks, shelves, group room and noticeboard. Read, train Coding/Charisma through appropriate materials, research a career, join a reading group, tutor and use a low-cost workstation. Offer accessible skill growth independent of nightlife or luxury membership.

**35 · Pedal & Patch:** bicycle shop, repair bench and route board. Rent/buy a bicycle, service it, practise repair work, plan a ride, join a social cycling session and train Fitness. Bikes are tangible mobility options with ownership/rental and condition, not cars with a renamed icon.

**Optional 36 · The Lantern Games Lounge:** if casino scope is adopted, a distinctly fictional adult game lounge with approved rules, transparent odds and original art. Free spectating/social food activities remain available. This venue is not required for a complete non-wagering London core.

**Content completion rule:** for each action above, Claude must write its unique definition: cost, duration, need changes, skill XP, gate, opening schedule, animation anchor, mood, rewards, chance outcome and cancellation. Shared systems are encouraged; identical content under every venue is not. All props that look interactive either open a real function or are visually identifiable as decoration.

## 31. Initial London balance sheet and exact example activity contracts

**DESIGN DEFAULTS — fictional game values, not real London prices:** use these as the first tuning set. All constants live in versioned content/configuration data. They establish a playable economy; they are not reverse-engineered source formulas. Adjust through simulation and playtests, and record changes rather than allowing each screen to invent its own amounts.

### Needs

Core needs start at 80 unless origin content specifies otherwise. Awake baseline decay per real hour: Hunger 6, Energy 4, Fun 3, Social 2, Hygiene 3, Bladder 8 points. Values clamp to 0–100. Activity effects below are net additions to baseline settlement; work styles have their own rates. Offline settlement cap defaults to eight hours, with a protected newcomer grace period of one calendar day. At 20 or below, show an urgent warning and an affordable recovery link; at zero, trigger a defined temporary consequence, never permanent loss of the character. Fine-tune the offline cap before launch.

### Skills

Skill XP cumulative level thresholds for levels 0–10: 0, 100, 250, 450, 700, 1,000, 1,400, 1,900, 2,500, 3,250, 4,200. A standard ten-minute practice earns 20 XP. Effective skill rust applies a maximum two-level drop relative to best, after the source-style seven-day grace and gradual subsequent decay. Keep earned XP, best level and effective current level distinguishable. Perks/certificates apply modifiers once to a defined quantity.

### Starter economics

Basic full shift gross £120; five eligible workdays/week gives £600 before fictional tax. A starter room rent is £80/week, basic food £3–£8/meal, public journey £2–£4, and a useful first furniture upgrade £30–£90. A newcomer starting with £100, a furnished room and first-week rent support can recover, commute and start earning without a purchase. An NPC tutorial contract pays £20 once, not on every refresh. Wealthy origins give different starting resources but do not remove skill/consent gates.

### Proposed personal-home tiers

| Tier | Grid | Weekly rent | Move-in amount | Residential purchase |
|---|---|---|---|---|
| Student hall | 6×6 | £50 | £150 | not purchasable |
| Shared room | 6×6 | £80 | £240 | £8,000 |
| Outer studio | 7×7 | £140 | £420 | £18,000 |
| One-bed flat | 8×8 | £240 | £720 | £36,000 |
| Family terrace | 10×10 | £480 | £1,440 | £85,000 |
| Premium townhouse | 12×12 | £1,000 | £3,000 | £220,000 |
| Riverside penthouse | 13×13 | £2,500 | £7,500 | £600,000 |
| Luxury mansion | 14×14 | £10,000 | £30,000 | £3 million |

Move-in is the source-style three-times-rent charge; label how much is deposit versus rent/fee rather than calling it all refundable.

Investment-home prices use a separate table and should be calibrated to net rental yield, occupancy, maintenance and resale. Do not derive them by reusing the residential purchase column. Source-like caps are five investment homes and twenty bare plots, enforced server-side. All proposed prices can change as a complete table after balancing, not individually in unrelated components.

### Careers and shifts

Career default: five ranks, each with grades I–III. Example baseline rank-I salary £120; rank-II £180; rank-III £280; rank-IV £450; rank-V £700, with grade II +5% and III +10%. Career multipliers distinguish specialised fields, with skill gates and certificates preventing instant access. Starting performance 50; promotion requires 100 after a qualifying completed shift and at least two completed shifts at the current grade. Reset performance to 60 on promotion as a London tuning default. Grade counts/reset are London choices because the source's universal table was not exposed.

Shift defaults: 60 real minutes; at least six minutes for prorated pay; one qualifying full shift/day unless a distinct overtime system is designed.

| Style | Performance/hour | Other effects |
|---|---|---|
| Steady | +10 | extra Energy −10, Fun −4 |
| Hard | +15 | extra Energy −20, Fun −10 |
| Socialise | +5 | Social +15 |
| Impress manager | +12 | bounded event risk |
| Take it easy | +3 | lower strain |

These rates integrate over style duration. Tasks and certificate/perk bonuses are explicit additional terms. Promotions evaluate after settlement, never during a profile read.

### Example action contracts, using the common lifecycle

- **Basic meal:** £5, two minutes, Hunger +30, Energy +2, Bladder −3; available at food hall/open café; consumes a named meal.
- **Cook pasta bowl:** £0 action fee, four minutes, Cooking +10 XP; consumes one pasta and one tomato unit and creates one meal; hob plus ingredients required. Eating the resulting meal is a separate action.
- **Shower:** three minutes, Hygiene +45, Energy +3; functional shower/hot water required, public fallback available.
- **Use toilet:** one minute, Bladder +65; usable facility required.
- **Nap:** ten minutes, Energy +25, bed/sofa required.
- **Sleep:** twenty minutes, Energy +55, Hunger −4, owned/authorised bed required.
- **Watch home TV:** eight minutes, Fun +25; owned powered TV, other compatible passive activity rules apply.
- **Read skill book:** ten minutes, designated skill +20 XP, Fun +6; bookshelf/library anchor and exact subject.
- **Practise guitar:** ten minutes, Music +20 XP, Fun +12; guitar required, shared household noise event optional.
- **Gym weights:** £8, ten minutes, Fitness +24 XP, Energy −10, Hygiene −8, Fun +8.
- **Park walk:** free, eight minutes, Fun +10, Energy −3, Fitness +6 XP; weather comfort may modify mood.
- **Coding sprint:** £4 public desk fee or free owned workstation, ten minutes, Coding +20 XP, Energy −4.
- **NPC conversation:** free, two minutes, Social +12, Charisma +4 XP, bounded NPC affinity; repeat cooldown.
- **Club dancing:** £12 admission if not already ticketed, ten minutes, Dance +20 XP, Fun +30, Energy −8, Hygiene −5; nightly opening gate.
- **Photography practice:** ten minutes, Photography +20 XP, Fun +10; designated scenic anchor plus camera/phone.
- **Paid photo gig:** ten minutes, £25 gross, Photography +12 XP, Energy −5; skill 2 and one client/session receipt.
- **Course class:** £30 baseline, 45 minutes, sequential lesson attendance, then notes/quiz; not immediate certificate.
- **Food-service side task:** five minutes, £15 gross, Enterprise/Cooking +6 XP, Energy −4; daily/capacity limit.

Every price/time in this list is proposed London balance.

### Currencies and simulation

Use two reward currencies only initially: game pounds and stars, plus non-spendable reputation XP. Money sources include wages, legitimate contracts, commerce, settled investments and bounded missions. Sinks include rent, food, travel, education, home upgrades, repair, staff, business costs and approved prestige spend. Gifts are transfers, not new money. A buy/sell loop must have non-positive net creation unless an explicit market opportunity is designed. Do not scale daily cash rewards so high that careers immediately become pointless.

Run seven-day, thirty-day and ninety-day deterministic simulations for poor, average and wealthy origins. Measure survival costs, discretionary cash, next-home time, first-company time, skill/career progression, offline obligations and inflation. Newcomers should afford basics after one sensible shift; mid-game upgrades should require choices; late assets should have upkeep. Publish a tuning report with parameters and identified exploit loops before adding new cash faucets.

## 32. Screen contracts and navigation flows

**Welcome/account:** title art, concise premise, sign-in/create account, resume if character exists, terms/privacy links and recoverable errors. Authentication never exposes passwords in game state. **Creation:** appearance preview → exactly two traits with effects → ambition → one persisted origin → starting home/tour. Back preserves choices; Submit is disabled during the one server creation request.

**World HUD:** selected location, world time/weather, mood, wallet, avatar and six need indicators; Scene, Buy, Map and Phone navigation. Tapping a need opens current value, cause/decay, recent effects and recovery actions. Activity progress shows target, time left and cancel policy. Journey progress shows origin/destination, mode, ETA and legal cancellation. Avoid presenting an active activity and an active journey as if both own the avatar.

**Map:** borough overview, venue labels, search/list, filters, homes/shops, weather/traffic and public journey access. Venue detail shows district, description, opening/status, requirements, meaningful activities, here-now presence, player shops and route options. Preview is free and does not move the character. Destination confirmation shows total fare, arrival time and origin; travelling updates physical location only at arrival.

**Home/Buy:** actual home cutaway, interactable owned items, storage/build controls and household access. Catalogue supports eleven source-equivalent categories, filter/price/quality/footprint, preview, colours, Buy and placement. Placement mode shows ghost validity and rotation; committed item offers use, move, recolour, store, sell and repair as appropriate. Design finishes use preview → Buy → Apply, with owned finishes reusable.

**Profile:** identity/outfit preview, needs/moodlets, goals/ambition/wishes, skill levels/rust, people/relationships, career grade/performance/history, badges and settings. Each tab has a meaningful empty state. Profile editing distinguishes free display preferences from paid appearance assets.

**Phone home:** app grid with labels and readable badge counts. Primary services are Jobs, Messages, Games, Contacts, Help, Courses, Travel, Food, Bank, Wardrobe, Rankings, Homes, Vehicles, Invitations, Health, Invest, Insurance, Family, Staff, Player Work, Transport Co, Company, Shops, Feed, Government, Police, Court, Ads and Settings. Source external promotional apps are not copied. App state is nested; Back returns to the prior app/list, Close returns to the world.

**Every list/detail:** title, active filters, loaded count, loading/empty/error state, stable pagination, selected item details, eligibility reason, commitment preview and receipt. Bank shows balances/ledger/bills; Jobs shows current career and full gate; Courses shows lesson progress, daily remaining classes and attendance/notes/quiz; Investments separates asset families; Company shows operating reports; Games distinguishes open tables from spectating; invitations/requests show pending expiry and sender.

**Error contract:** disabled controls explain a specific reason such as missing £8, Coding level 3, closed until 22:00, arrival required, existing shift, table full or invite expired. On conflict, refresh the affected entity and preserve user input. Do not show a generic failure and then deduct money anyway. Receipts persist even if the success toast disappears.

**Navigation acceptance:** open every app from the same world, use nested Back and Close, reopen on a small viewport, rotate device, reconnect and ensure the current activity persists. No phone action changes location except an explicit confirmed journey. Keyboard focus returns to the triggering control when a sheet closes.

## 33. A complete first twenty minutes

**DESIGN DEFAULT onboarding route:**

- **Minute 0–3:** create an adult character, choose traits/ambition and receive one persisted origin.
- **Minute 3–5:** arrive in a characterful starter home and inspect the six needs; highlight a bed, toilet, basic cooker and storage.
- **Minute 5–8:** make/obtain one affordable meal and eat it, showing ingredient/meal distinction and a concrete need change.
- **Minute 8–10:** use shower or toilet and receive a small first-tour star reward exactly once.
- **Minute 10–13:** preview the local food hall/community centre, compare walking/public transport and take a short district journey. Arrival introduces one clearly NPC local and a simple greeting.
- **Minute 13–16:** complete a short NPC service task with real timer/outcome and a £20 receipt.
- **Minute 16–18:** choose an attainable career or introductory course, with the true longer timer visible; do not pretend a full hour passed to fit the tour.
- **Minute 18–20:** return/preview home, buy and place one useful £30–£50 item using earned funds, then see the completed daily mission and next goal.

The route is optional and skippable in stages, with persistent completed steps. It proves identity, needs, inventory, travel, activities, money, missions, furniture and saving in one coherent session. New players are not forced to contact strangers, buy currency, gamble or consent to notifications. Returning after a reload should show the same character, location, item placement, meal history and next goal.

## 34. Wardrobe, pets and late-game prestige assets

**OBSERVED SOURCE:** the Boutique exposes clothing, shoes, bags and wigs. The character has outfit contexts Everyday, Home, Sleep, Date, Party, Work and Gym. Furniture includes a cat, dog and parrot, and prestige items such as a throne, artwork, vault, helicopter, yacht and three jet classes. The catalogue shows jet upkeep at ₦15 million, ₦40 million and ₦120 million per week. Catalogue visibility is established; pet-care depth, most luxury interactions and apparel bonuses were not played.

**LONDON REQUIREMENT:** a garment definition contains type, mesh/material variants, supported body rigs, colour choices, context tags, price, source and any declared comfort/prestige effect. Owned garment instances are distinct from the currently equipped outfit. Buy creates ownership once; equip changes a context slot; preview is free and reversible. Duplicate ownership rules are explicit. Outfit context can switch on sleep, gym, work or an event while preserving the player's saved selections. Never overwrite the Everyday outfit permanently just because a uniform is temporarily active.

Style UI provides a full character preview, category filters, current owned/equipped state, price and final result. Hairstyle changes are applied through an appearance record and compatible rig; hats/coats must have a tested clipping rule. Clothing diversity includes ordinary affordable basics, formal/business wear, creative vintage, sportswear, evening clothes, weather layers and cultural styles. High price is not a proxy for gender, ethnicity or attractiveness.

Appearance and game identity remain separate from account settings. Changing a public display name does not recreate the character, reroll an origin or erase relationships. Item resale, gifting and player-company fashion stock are optional capabilities that need one consistent inventory/transaction model.

**Pet DESIGN DEFAULT:** an adopted pet is an owned household entity, not a static decoration only. Minimum useful care actions are feed, play, clean and rest, with a visible wellbeing meter, named pet, simple idle/follow/rest animations and placement/household permissions. Food is a consumable and daily maintenance is displayed before adoption. Owners can safely rehome through a clear game flow; inactivity should prompt recovery rather than permanent punitive harm. Do not claim these default rules were verified in Lagos. Start with cat and dog; parrot requires its own audio/animation and readable mute controls.

Prestige objects must justify their world footprint. Artwork is visible and contributes a capped décor/mood score; a pool table opens a home game; an advanced workstation improves a declared training rate; a home theatre restores Fun. Vault/throne/luxury décor should not create unlimited money by being clicked. Helicopters/jets/yachts, if implemented, need ownership, docking/storage location, maintenance bills, journey or event functions and permission rules. A yacht purchased in a furniture catalogue is still a transport/event asset behind that catalogue entry, not a sofa-shaped house prop.

**Acceptance:** preview/cancel without debit; buy/retry once; equip all seven contexts; body variants and hairstyle/hat clipping; work uniform restored after shift; pet care after reconnect; moving pets with a home; prestige upkeep settled once; private aircraft route requiring the owned craft rather than a displayed model.

## 35. Technical architecture and authoritative simulation

**LONDON IMPLEMENTATION REQUIREMENTS:** choose a maintainable client/server architecture that supports persistent characters, transactional money/inventory, background schedules and real-time multiplayer. The backend owns outcomes; the client renders world, UI and responsive animation. A browser-only local-storage prototype cannot be called the finished shared game. Offline local play may be a deliberately separate mode, but it must not write fabricated multiplayer results into the online economy.

The renderer may use a browser 3D engine; UI can use a component framework; data can use a relational transactional store or an equivalent system with strong invariants. Specific libraries, versions and hosting provider should be chosen after confirming current official documentation and deployment constraints. This document defines contracts rather than requiring one vendor. Keep credentials exclusively in server configuration; asset URLs and public ids may be in the client.

### 35.1 Core records and ownership

**Account:** authentication identity, created time, adult eligibility if required, privacy/settings, moderation state. **Character:** account owner, chosen appearance, two trait ids, ambition, immutable origin assignment/version, creation state, current location, home/household and progression. **Need state:** six values, settlement timestamp and active rate modifiers. **Skill state:** skill id, earned XP, best level, effective level and last-use timestamp. **Mood instance:** definition, source, strength, start/expiry and stacking group.

**Activity/journey/shift/course records:** owner, definition/version, location/target, start/end, status, input events, charged resources, reward/settlement reference and cancellation. A shift also stores career grade snapshot, style intervals, stages and tasks. A course enrolment stores ordered lesson state, attendance, quiz attempts, daily quota and certificate. Career progress stores current job, rank/grade, performance, qualifying shifts and history.

**Economy:** ledger accounts, immutable transaction entries, balances checked against ledger, escrow locks, income/tax periods, bill items, savings accrual and bonds. **Inventory:** stackable resource counts, unique owned-item instances, condition, location/storage, provenance and equipment slots. **Furniture placement:** instance, home, grid position, orientation, footprint layer and interaction clearance. **Home/property:** residence product, layout, owner/lease, household, décor, utility/condition and access policy.

**World:** city/district/venue ids, scene/asset manifests, doors and anchors, route graph, opening calendar, weather period and city news. **Businesses:** passive asset, operating company, staff contract, catalogue/stock, order, fulfilment and daily settlement. **Development:** land parcel, title, stage graph, construction contract and resulting building. **Vehicles:** asset class, owner/fleet, fuel/condition, route assignment, bookings and depreciation.

**Social:** relationship edges, accepted requests, conversation/message, household role, invitation, party and expiring presence. **Progression:** mission assignment/progress/claim, login claim, wishes, ambition milestones, owned perks, story run and treasure claim rank. **Public services:** election/term/candidate/ballot/policy, crime event, custody, case/remedy, insurance policy/hazard/claim, feed/comment/reaction, ad booking and moderation report. **Games:** table/seats, private hands, public board state, ordered move events, clocks and result settlement.

Definitions and live instances are different. Updating a salary, furniture price or recipe should create a content version; a running shift/paid order resolves against its accepted snapshot. Schema migrations preserve balances, furniture placements, origins and relationships. A broken old item definition must not silently delete possessions on load.

### 35.2 Command contracts

Mutating requests carry authenticated actor, command type, target ids, expected state/version and a unique idempotency key. Server checks ownership/access, legal state, location, time, money, inventory, skill, schedule and limits. Commit debit, status and resulting event atomically; return a receipt and the canonical state. A retry with the same key returns the original outcome. A different key for the same unique claim still fails through the entity's uniqueness constraint.

Representative commands: `CreateCharacter`, `StartActivity`, `CancelActivity`, `CompleteActivity`, `StartJourney`, `CancelJourney`, `SetWorkStyle`, `SubmitWorkTask`, `SettleShift`, `EnrolLesson`, `SubmitQuiz`, `BuyItem`, `CommitPlacement`, `StoreItem`, `MoveHome`, `Deposit`, `Withdraw`, `CreateBond`, `AcceptTransferRequest`, `HireStaff`, `RegisterCompany`, `BuyShopOrder`, `AcceptContract`, `SubmitContract`, `ReleaseEscrow`, `SendMessage`, `AcceptRelationship`, `CreateInvite`, `AdmitGuest`, `ClaimMission`, `ChooseStoryOption`, `ClaimTreasure`, `JoinTable`, `SubmitGameMove`, `CastBallot` and `ResolveCase`. Command names are illustrative; their behaviours must follow the system chapters.

Read APIs return only authorised information. Public profiles cannot include private conversations, account identifiers or secret game cards. Access grants are scoped and server-checked. Errors use stable codes and useful user messages. Rejected mutations do not partially debit. Money/inventory cannot be trusted merely because a UI button was disabled.

### 35.3 Time settlement and concurrency

Use server UTC instants for timers and named Europe/London calendar rules for daily/weekly schedules. Store both period keys and precise timestamps. Daily mission/login/election boundaries survive daylight-saving transitions. Do not compute "a week" as whatever the browser reports or reset to a new period on every reconnect.

Need settlement: load prior values and active modifiers; integrate the interval in segments across activity/mood/style boundaries; apply rates/effects in documented order; clamp; store new values and timestamp once. Long offline gaps use the selected cap/recovery rule. Claims/activities at the same instant settle in a deterministic order. A client countdown is presentation; it is not the completion authority.

Scheduled workers settle bills, business income, bond maturity, daily content, elections, ads, hazards and expired invitations. Each job has a unique entity/period key and can safely run again after a crash. Lazy settlement on a player load may supplement workers, but it must call the same idempotent transaction logic. A scheduler and a login cannot both pay the same day.

Use transactions/conditional updates for scarce seats, stock, property and money. Lock or version the affected entity, not the whole world. Append notifications through a durable post-commit event/outbox so a receipt isn't lost if realtime delivery fails. Event consumers deduplicate. Optimistic UI may show "pending" but cannot spend an unconfirmed reward.

### 35.4 Realtime, saving and failure handling

Realtime channels support venue presence, party guests, messages, game turns and public counts. Presence expires with a heartbeat/lease; it does not persist as "online" forever. Reconnect returns a full canonical snapshot plus events after the last acknowledged sequence. Game commands are ordered/versioned. Rendering interpolates avatar movement, while destination and interaction eligibility remain server-validated.

Save after each committed command, not only on browser unload. Local cache stores safe UI state, asset cache and unsent drafts; server remains canonical. Multi-device sessions have defined conflict behaviour for location and active activity. Distinguish connection loss, authentication expiry, stale state and insufficient funds. Recovery should reload canonical state without discarding a user's unsent chat or arrangement draft.

Maintain structured audit logs for economy and critical permission changes with private data minimised. Add health/error monitoring for scheduler backlog, settlement failures, realtime reconnects, missing asset loads and ledger imbalance. Admin tools require explicit access controls; player civic officials are not admins. Backup and restore are tested with realistic characters and placements before launch.

## 36. Asset pipeline, performance, accessibility and delivery quality

**Asset manifest:** every building, character, furniture item, garment, vehicle and animation has stable id, creator/licence, source file, export version, scale, pivot, collision, footprint, anchors, level of detail, material/texture budget and thumbnail. Original assets or properly licensed libraries only; do not extract/reuse Lagos Life's private models, textures, code, branding or dialogue. Placeholder assets must be labelled in the build tracker and replaced before final visual sign-off.

Build an original kit first: brick/stucco/warehouse building modules; doors/windows/roofs; pavement/kerb/road; iron railing; streetlight; trees/planters; bench/bin/bollard; station/market/pub signs; bus/bike/taxi; modular home walls/floors; essential bed/kitchen/bath/sofa/desk; adult character rig and core animation set. Venue-specific hero pieces then add identity: music stage, pool board, gym equipment, café counter, campus lecture seats, rooftop terrace and river boat.

Asset review checks unit scale, silhouette at game camera, normals/materials, lighting in day/night/rain, collision and interaction reach. Furniture footprints must match actual visual extents; wall décor uses wall anchors, rugs use floor overlay rather than blocking walking, and yard assets are separate from indoor grid. Character collision and camera wall fade are tested in the smallest starter home.

**Performance TARGETS, to validate on real hardware:** first meaningful playable view within five seconds on a representative midrange phone/ordinary connection; ≥30 fps on that mobile tier and ≥60 fps on a recent desktop during common scenes. Stream the current district, keep the initial transfer around 5–10 MB where feasible, reuse atlases/instancing and cap texture sizes by asset importance. These are targets rather than measured claims. Record device, browser, scene and capture method in test reports.

Quality presets alter shadow resolution, reflected effects, crowd density, particle count, render scale and texture detail without hiding gameplay. Pause unnecessary rendering in background tabs, lower idle frame rate and reduce polling with events/caching. Data/battery mode retains readable venue lists, needs, money, journeys and all accessible actions. Cache immutable versioned assets; don't cache another user's private character response in a shared public service-worker cache.

Responsive desktop uses a side sheet while leaving world context; mobile uses a bottom sheet with safe areas and sufficient touch targets. Drag controls also have rotate/move/commit buttons. Browser/device resize never changes the server state or accidentally submits a purchase. Real keyboard navigation supports all menus and accessible placement; avoid stealing WASD while typing in chat. Game boards support clear legal-move feedback and readable timers.

**Accessibility:** semantic headings/buttons, visible focus, labelled controls, high-contrast text, icons plus labels for needs, reduced motion, subtitle/caption support for spoken authored content and separate sound controls. Do not encode sole information through colour, sparkles, hover or sound. An accessible venue directory and furniture action list supplement the 3D view. Reduced motion removes camera swoops and flashes without shortening authoritative activity time.

PWA/install can be offered after a useful session; it never blocks play. Account recovery, offline/unavailable screen, safe reconnect and privacy/settings are tested. A no-WebGL or failed-render fallback should offer a clear message and usable essential menus where possible rather than a blank screen. Empty multiplayer spaces and unavailable external services have honest states; the game should remain enjoyable solo through NPCs, authored stories and skill/career/home progression.

## 37. Acceptance suite and definition of done

Use meaningful automated tests for domain invariants and integration tests for transactions, not hundreds of tests that merely repeat rendered labels. Add focused end-to-end routes for the connected player experience. Screenshots are evidence of presentation, not proof of money/persistence correctness.

- **A · New life:** create once, exactly two traits, one origin, correct starting inventory/job/home; reload during creation and after tour. No duplicate starter grant or reroll.
- **B · Care loop:** settle six needs through elapsed time, cook from owned ingredients, eat a separate meal, sleep/shower/toilet through actual furniture; test no ingredients, no power and low-income fallback.
- **C · World:** preview does not move, journey arrives once, cancellation policy matches, street door and map point share location, closed venue and membership gate reject before debit.
- **D · Work/study:** start one shift, change styles halfway, perform meaningful tasks, fail one, exit below/above minimum, calculate payslip, complete another and promote only at correct gate. Attend a sequential course, resume timer, read notes, answer quiz, respect two-class daily limit, issue one certificate.
- **E · Home:** buy/rotate/place odd-size furniture, test collision/clearance, store/sell, preview/cancel paint, move down a tier, transfer overflowing items to storage, settle origin-subsidised rent correctly.
- **F · Economy:** compare ledger and balances; simultaneous debit; savings/bond rollover; duplicate daily/weekly settlement; separate wage/business tax; after-crash worker retry; invest/resell without a money-creation loop.
- **G · Commerce:** real two-account purchase, last-stock race, fulfilment/refund, company revenue report, fleet seat reservation and condition/upkeep.
- **H · Player contracts:** fund/accept/perform/submit/release/dispute with two accounts, verify scoped permissions and escrow reconciliation.
- **I · Social:** NPC versus human identity, requests accept/decline/expire, block stops contact, invitation admission/revoke, eight-guest capacity, party end, household role permissions, private chat unread state.
- **J · Progression:** daily reset/streak/swap, claim once, perk effects, wishes, ambition cooldown, seeded story branch after reload, global treasure-rank race.
- **K · Games:** all implemented rule engines finish legally; seats/turns/clocks/reconnect/forfeit/draw work; spectator data hides cards; pot/fee/refund settles once.
- **L · Civic/risk:** ballot uniqueness, account-age gate, cutoff/tie/term handover; recorded-evidence court, game reports versus moderation, policy/premium expiry, weather-linked hazard sampling and low-income recovery.
- **M · Product quality:** mobile/desktop/touch/keyboard, reduced motion/audio mute, slow network, background/reopen, renderer failure, all app empty/error states, asset licences, frame/memory/download measurements and restored backup. Run with a poor origin and a wealthy origin; a privileged starter must not conceal a broken basic economy.

**Release definition:** every advertised feature is working, deliberately disabled with an honest roadmap label, or removed from that release's promise. No invented users, simulated humans, fake successful payments, hard-coded congratulations, empty game boards or TODO buttons that report success. Core progression, owned possessions and money survive logout/reload. The main world, starter home and first borough pass visual review. Publish the completed-scope matrix, remaining issues and actual test results alongside the build.

## 38. Claude build handoff and milestones

**Instruction to Claude:** read this entire specification before coding. Produce an implementation plan and a feature-status matrix keyed to its chapters. Treat OBSERVED/PLAYED SOURCE as behavioural evidence; treat LONDON REQUIREMENTS as intended product behaviour; treat DESIGN DEFAULTS as chosen initial proposals; keep OPEN QUESTIONS visible. Do not claim source parity or completion for unimplemented systems. Build original London art, copy and content, with server authority and persistent outcomes.

**Milestone 1 · Complete foundation:** authentication/character/origin, needs/time/ledger, one beautiful furnished home, one small borough, travel, several distinct care/training/earning activities, inventory/furniture placement and reload. Prove the twenty-minute route with a low-income character. This is a vertical slice, not the final requested scope.

**Milestone 2 · Depth and city content:** full careers/tasks/promotions, courses/quizzes, goals/perks/stories, wardrobe, housing tiers, utilities/food/staff, all London venue definitions and principal borough scenes. Add the bank, bills and realistic recurring costs. Validate balancing and meaningful variety, then replace remaining core visual placeholders.

**Milestone 3 · Shared life:** real presence/chat/requests, consent-based relationships/visits/parties, player jobs/escrow, companies/shops/orders, landlord/tenant flow and public feed. Use two or more controlled test accounts; one-account mocks cannot validate these systems.

**Milestone 4 · Games and civic simulation:** friendly real-time games with legal rules, spectator/reconnect/results, elections/policies, fictional police/court and moderation. Add fictional stakes/casino only after that separate product decision. Civic simulation cannot substitute for basic platform safety controls.

**Milestone 5 · Late-game economy and finish:** land/construction, fleets/haulage, insurance/condition/weather, prestige assets, ads and deeper family/pet content. Complete mobile/performance/accessibility, account recovery, monitoring and restore tests. Revisit art consistency across every borough and home tier. Final parity means the committed scope is functional, not that all tiles exist.

For each milestone deliver running code, seeded content, migration/setup instructions, tested acceptance scenarios, a few representative screenshots and a candid status matrix. Commit small coherent changes. Avoid building the entire app in one unstructured component or baking balancing constants into UI handlers. Keep content data, simulation services, scene assets and presentation modules separate. Choose dependencies based on current official documentation, verify versions and state how to run locally and deploy.

Before public deployment, present the concrete playable release and its remaining limitations for user review. Do not send this document to another account, change its sharing settings or publish it as part of the build without the user's instruction. This handoff is an implementation brief, not automatic authorisation for third-party messaging or public release.

## 39. Evidence limits and outstanding decisions

**Research coverage:** 160 recorded source screens/interactions/visual observations by 9 October 2026. Directly played: onboarding after user sign-up, one partial banking shift and work event/task, cooking/eating, shower, furniture purchase/rotation/placement, daily reward claims, public travel and street movement, NPC greeting and a complete five-step wedding story. Spectated: live pool, Ayo and a Whot result. Inspected: phone apps, career/course catalogues, home/vehicle/investment listings, staff, insurance, relationships, player work, companies/shops, games lobbies, civic/crime/court, settings, 11 furniture categories, Lagos venue previews and other-city directories.

We did not exercise human messaging/relationships, staffed homes, real player contracts, running companies, ownership caps, full courses, late rank promotions, elections, police arrest/trials, hazard claims, private aircraft or every game as a participant. Account age, wealth, timers and social consent gate some of these. Do not convert inspected explanatory text into a claim of tested behaviour or undocumented internals.

**Source unknowns needing further targeted play:** exact needs decay and emergency thresholds; all trait effects; mood duration/stacking; full career grade/salary tables; working-hours discrepancy; promotion reset; course failed-quiz retries; global furniture interactions/stars and resale; ownership/tenancy termination; price cohorts/caps; exact business demand, stock and revenue; staff home-size thresholds; full marriage/child progression; game house-rule variants and pool physics; custody/bail/court timing; hazard sampling and insurance excess; investment valuation/sales; ad review/link restrictions.

**London product decisions:** final title/brand; adult eligibility and tone; origin probabilities and whether choice is allowed; final trait roster; offline decay grace; server calendar; exact grade ladder; game-currency tax/rates; deposit/refund terms; fictional stakes/casino; public crime mechanics; national/intercity scope; family and child detail; monetisation; external music/radio licences; public-location privacy; relationship limits; asset/art provider; hosting/realtime/store selection; moderation operation. This document provides implementable defaults where stated and keeps the remaining choices honest.

Future research should append a dated finding to the relevant chapter, identify observed versus played evidence, and update conflicting requirements rather than adding contradictory parallel rules. Keep a change log with source finding, affected system and adopted London choice. A new fact can change a default; it should not retroactively be described as originally verified.

## 40. Source catalogue appendix for implementation reference

**OBSERVED SOURCE ONLY:** these names, prices, footprints and entry wages were visible in the inspected account/cohort. They support research and system coverage; they are not London balance values or permission to copy branding/assets. Full later-rank salaries and item effects were not exposed. London content should be original and versioned.

### 40.1 All 33 inspected career entries

| # | Career | Entry role | Entry pay per shift |
|---|---|---|---|
| 01 | Tech | Intern I | ₦8,600 |
| 02 | Banking | Marketer I | ₦10,100 |
| 03 | Music | Backup Singer I | ₦6,400 |
| 04 | Trading | Shop Assistant I | ₦7,200 |
| 05 | Nursing | Student Nurse I | ₦7,900 |
| 06 | Hairstyling | Salon Assistant I | ₦6,400 |
| 07 | Chef | Dishwasher I | ₦6,400 |
| 08 | DJ | Hype Man I | ₦7,200 |
| 09 | Fitness Coach | Gym Floor Assistant I | ₦6,400 |
| 10 | Content Creator | Aspiring Creator I | ₦5,700 |
| 11 | Teaching | Lesson Teacher I | ₦7,200 |
| 12 | Event Planning | Canopy Boy/Girl I | ₦6,400 |
| 13 | Football | Viewing Centre Attendant I | ₦5,700 |
| 14 | Retail | Sales Rep I | ₦6,400 |
| 15 | Law | Law Clerk I | ₦7,900 |
| 16 | Medicine | House Officer I | ₦18,300 |
| 17 | Civil Service | Administrative Officer I | ₦14,800 |
| 18 | Broadcasting | Newsroom Reporter I | ₦15,700 |
| 19 | Real Estate | Estate Agent I | ₦15,700 |
| 20 | Aviation | Cabin Crew I | ₦16,500 |
| 21 | Product Management | Associate PM I | ₦17,400 |
| 22 | Oil & Gas | Field Technician I | ₦17,400 |
| 23 | Airport Staff | Check-in Agent I | ₦10,400 |
| 24 | Civil Service | Admin Officer I | ₦14,800 |
| 25 | Keke Riding | Keke Rider I | ₦6,400 |
| 26 | Wuse Market Trading | Shop Attendant I | ₦7,200 |
| 27 | Mai Shayi | Tea Spot Hand I | ₦6,400 |
| 28 | Lounge Waiting | Waiter I | ₦5,700 |
| 29 | Creek Road Trading | Market Trader I | ₦7,200 |
| 30 | Ferry Work | Ferry Hand I | ₦6,400 |
| 31 | Bole & Fish | Bole Seller I | ₦6,400 |
| 32 | Security | Security Guard I | ₦6,400 |
| 33 | Refining | Operator Trainee I | ₦12,200 |

Some names repeat because the source has city-specific career instances, notably Civil Service. Distinct city/workplace and skill-entry predicates must remain in data rather than merging solely by display name. Mid-level source gates include Fitness 3 for Medicine/Aviation, Hustle 3 for Lagos Civil Service, Comedy 3 for Broadcasting, Charisma 3 for Real Estate and Coding 3 for Product Management. Oil & Gas uses Fitness OR Coding 3 and Port Harcourt; Abuja Civil Service uses Charisma OR Coding 2.

### 40.2 Courses

Thirteen families, each five lessons:

| Course | Fee per lesson |
|---|---|
| Lawyer | ₦3,000 |
| Doctor | ₦3,500 |
| Software Developer | ₦3,000 |
| Banker | ₦2,500 |
| Chef | ₦1,500 |
| Musician/Artiste | ₦2,000 |
| Fashion Designer | ₦2,000 |
| Pilot | ₦4,000 |
| Real Estate Pro | ₦2,500 |
| Journalist/Broadcaster | ₦2,000 |
| Entrepreneur | ₦2,000 |
| Civil Engineer | ₦3,000 |
| Money Smart | ₦1,000 |

Each advertises 45-minute attendance, notes and three-question quiz, with two new classes/day. This confirms a broad education catalogue, not just Coding.

### 40.3 Furniture, footprints, quality and colour variants

Notation: size is the visible placement footprint; wall and yard are distinct placement layers; Q is the displayed star count; C is the displayed colour count. Omitted Q/C means no such badge was displayed, not proof of zero gameplay effect. The base Comfort tab was captured as Furniture shop. Exact effect/recovery rates require further interaction study.

**Comfort (13 observed items)**

- Plastic Chair — ₦500; 1×1, C5
- Standing Fan — ₦2,200; 1×1
- Dining Table — ₦6,600; 2×2, Q2
- Lounge Armchair — ₦8,500; 1×1, Q2, C8
- Velvet Sofa — ₦10,200; 2×1, Q2, C8
- Bean Bag — ₦12,000; 1×1, Q1, C10
- Rechargeable Standing Fan — ₦18,500; 1×1
- 3-Seater Family Sofa — ₦24,000; 3×1, Q3, C8
- Italian Leather Sofa — ₦32,000; 2×1, Q3, C4
- Ceiling Fan — ₦32,000; 1×1
- Royal Gold Sofa — ₦55,000; 2×1, Q4, C8
- Split Air Conditioner — ₦650,000; wall, Q1
- Lekki Sectional Sofa — ₦1,500,000; 3×1, Q4, C8

**Sleep (9 observed items)**

- Foam Mattress — ₦1,800; 1×2
- Spring Bed — ₦7,800; 1×2, C8
- Bunk Bed — ₦24,000; 1×2, Q1, C8
- Lekki King Bed — ₦28,800; 2×2, Q3, C8
- Sliding Wardrobe — ₦85,000; 2×1, Q2, C5
- Upholstered Queen Bed — ₦95,000; 2×2, Q3, C8
- Four-Poster Canopy Bed — ₦2,800,000; 2×2, Q4, C8
- Walk-in Closet Display — ₦6,500,000; 2×1, Q4, C5
- Rotating Round Bed — ₦45,000,000; 2×2, Q4, C8

**Kitchen (13 observed items)**

- Cooler Box — ₦700; 1×1
- Kerosene Stove — ₦1,100; 1×1
- Kitchen Counter — ₦4,200; 1×1, Q1, C5
- Kitchen Sink — ₦4,800; 1×1
- Gas Cooker — ₦8,400; 1×1
- Double-Door Fridge — ₦13,200; 1×1
- Kitchen Blender — ₦22,000; 1×1
- Microwave — ₦38,000; 1×1
- Water Dispenser — ₦58,000; 1×1
- Air Fryer — ₦75,000; 1×1
- Chest Deep Freezer — ₦165,000; 1×1
- Marble Kitchen Island — ₦380,000; 2×1, Q3, C5
- 5-Burner Cooker & Oven — ₦420,000; 1×1, Q1

**Bath (7 observed items)**

- Bucket & Bowl — ₦400; 1×1
- Water Drum & Jerrycans — ₦800; 1×1
- WC Toilet — ₦3,000; 1×1
- Rain Shower — ₦11,400; 1×1
- Bathtub — ₦19,200; 2×1, Q2
- Washing Machine — ₦480,000; 1×1
- Jacuzzi — ₦25,000,000; 2×2, Q4

**Fun (9 observed items)**

- Transistor Radio — ₦1,000; 1×1
- Party Speakers — ₦7,200; 1×1
- 32" Flat TV — ₦10,800; 1×1
- 65" Smart TV — ₦38,400; 2×1, Q2
- Home Theatre System — ₦280,000; 2×1, Q2
- PS5 Gaming Setup — ₦850,000; 1×1, Q1
- 75" OLED Smart TV — ₦2,400,000; 2×1, Q3
- Snooker Table — ₦3,500,000; 2×1, Q3
- Home Cinema Wall — ₦18,000,000; 3×1, Q4

**Skills (9 observed items)**

- Standing Mirror — ₦1,700; 1×1, Q1
- Dumbbell Rack — ₦3,400; 1×1
- Bookshelf — ₦3,600; 1×1, Q1, C5
- Acoustic Guitar — ₦4,200; 1×1
- Ring Light & Phone Stand — ₦9,500; 1×1
- Laptop Desk — ₦18,000; 2×2
- DSLR Camera & Tripod — ₦24,000; 1×1
- Library Bookcase — ₦160,000; 2×1, Q3, C5
- Grand Piano — ₦12,000,000; 2×2, Q4

**Light (10 observed items)**

- Rechargeable Lamp — ₦1,100; 1×1, Q1
- Fairy Lights — ₦4,500; wall, Q2, C4
- Bedside Lamp — ₦6,500; 1×1, Q1
- RGB LED Strip — ₦9,000; wall, Q2, C6
- "I Better Pass My Neighbour" Gen — ₦14,400; yard
- Brass Wall Sconces — ₦18,000; wall, Q2
- Arc Floor Lamp — ₦28,000; 1×1, Q2
- Pendant Lights — ₦45,000; 1×1, Q2
- Solar + Inverter — ₦78,000; 1×1, Q1
- Crystal Chandelier — ₦35,000,000; 1×1, Q4

**Decor (23 observed items)**

- Wall Calendar — ₦300; wall, Q1
- Fela Poster — ₦600; wall, Q1
- Potted Plant — ₦700; 1×1, Q1
- Wall Clock — ₦2,500; wall, Q1
- Ankara Rug — ₦2,600; 2×2, Q2, C6
- Partition Wall — ₦3,000; 1×1, Q1
- Snake Plant — ₦3,200; 1×1, Q1
- Planter Divider — ₦3,800; 1×1, Q2
- Wooden Slat Divider — ₦4,500; 1×1, Q2
- Adire Wall Art — ₦5,400; wall, Q3
- Ankara Folding Screen — ₦5,500; 1×1, Q3
- Glass Coffee Table — ₦6,500; 1×1, Q2, C5
- Frosted Glass Partition — ₦6,500; 1×1, Q2
- Persian Runner Rug — ₦7,800; 2×1, Q3, C6
- Ankara Curtains — ₦8,500; wall, Q2, C4
- Bird of Paradise Plant — ₦14,000; 1×1, Q2
- Shaggy Rug — ₦18,000; 2×2, Q2, C6
- Sunburst Wall Mirror — ₦38,000; wall, Q3
- Aso-Oke Runner — ₦45,000; 3×1, Q3, C6
- Silk Curtains — ₦120,000; wall, Q3, C5
- Aquarium — ₦1,200,000; 1×1, Q4
- Royal Persian Carpet — ₦4,500,000; 3×3, Q4, C6
- Gold Lion Statue — ₦50,000,000; 1×1, Q4

**Pets (3 observed items)**

- Mimi the Cat — ₦15,000; 1×1, Q1
- Bingo the Local Dog — ₦25,000; 1×1, Q1
- African Grey Parrot — ₦45,000; 1×1, Q2

**Luxury (8 observed items)**

- Diamond-Studded Throne — ₦250,000,000; 1×1, Q4
- Old Master Painting — ₦400,000,000; wall, Q4
- Gold Bullion Vault — ₦500,000,000; 1×1, Q4
- Private Helicopter — ₦750,000,000; yard, Q4
- Light Jet — ₦1,200,000,000; yard, Q4; upkeep ₦15m a week
- Superyacht — ₦1,500,000,000; yard, Q4
- Private Jet (Mid) — ₦3,000,000,000; yard, Q4; upkeep ₦40m a week
- Heavy Jet — ₦9,000,000,000; yard, Q4; upkeep ₦120m a week

**Design finishes:** wall paints Classic Cream, Lagos Sky, Mint Fresh, Peach Glow and Soft Lilac cost ₦3,000; Naija Green ₦4,000; Lekki Charcoal ₦5,000; Owambe Gold ₦6,000. Floors: Terrazzo ₦5,000; Wood Parquet ₦8,000; White Marble ₦12,000; Black Marble ₦15,000; Blue Ceramic ₦6,000; Checkerboard ₦7,000; Terracotta ₦6,000. Preview before Buy; purchased finishes remain owned; visitors see committed finishes; kitchens/bathrooms retain their tiles.

### 40.4 Further play-study checklist

Next source sessions should target: one full work shift and promotion; one paid class through quiz and retry; appliance interactions across all functional categories; one vehicle test/service journey; one affordable running business after purchase; shop order with controlled consenting test accounts; contract/visit consent with controlled accounts; all five game tutorial/legal move variants; insurance renewal and an eligible hazard; account-age civic flow. Do not disturb unrelated real players merely to verify a feature. Append findings to the relevant chapter and revise defaults where evidence warrants.

---

## Decision log

| Date | Decision | Affected chapters | Status |
|---|---|---|---|
| 2026-10-10 | Audience is adults only (18+). Account creation requires an age confirmation; all characters are adults. | 5, 19, 32, 39 | Adopted (owner) |
| 2026-10-10 | Casino, sports predictions and fictional-currency stakes stay out of scope for now; all table games are friendly. Venue 36 is not built. | 22, 23, 30, 39 | Adopted (owner) |
| 2026-10-10 | Working title remains "London Life". | 39 | Provisional |
| 2026-10-10 | Stack default: Next.js + React, Three.js via react-three-fiber, Postgres (local in development, hosted provider such as Supabase later). | 35 | Provisional, pending owner confirmation |
| 2026-10-10 | Differentiators proposed: flatmates, the flat hunt, commuting as gameplay, local-regular status, London calendar events, photo mode tied to careers, Claude-powered named NPC conversations, allotment and fictional blue plaques. Early picks: flatmates, commuting, local regular, photo mode. | new | Proposed, pending owner confirmation |
