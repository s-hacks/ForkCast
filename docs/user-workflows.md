# User Workflows and Guides

## What the colors mean

Every status shows a color, an icon and a text label together.

| Color | Label | Meaning |
|---|---|---|
| White | Available | Nobody has committed to this need yet, and help is welcome. |
| Yellow | Partially booked | Some help is committed, but more is still needed. |
| Gray | Fully booked | This need is covered. You can still open the meal to see details. |
| Gray, leaf icon | Not needed | Covered another way. For example, prepared food covers every serving, so no ingredients are needed. |
| Red | Needs attention | An admin changed the meal and existing commitments now exceed it. |
| Dashed | Not scheduled | No published meal plan yet. |
| Clock | Closed | The meal time has passed. |

Each meal has three separate needs, called lanes: **prepared food**, **ingredients** and **serving**. A booked serving volunteer does not mean the food is covered, and covered food does not mean serving is filled.

## Volunteer guide

1. **Sign in.** Choose *Enter as Volunteer* and enter your username and password. A failed attempt always shows the same message, and repeated failures pause sign-in for 15 minutes.
2. **Choose how you are participating.** Pick *Solo*, or one of your organizations. In an organization context you also see what your group has committed. You never see other groups' details, only the totals they leave available. Use *Change* in the header to switch.
3. **Use the calendar.** Move between months, pick a day, and open breakfast, lunch or dinner.
4. **Bring cooked food.** Enter how many servings you will bring, up to the number remaining.
5. **Plan ingredients: Bring groceries.** The table lists each ingredient with these columns:
   - required
   - in pantry
   - allocated to other meals
   - reserved for this meal
   - pledged
   - what the pantry will cover
   - what is still needed

   Tick the items you will buy and enter quantities, up to the amount still needed. When you confirm, the pantry stock that can cover this meal is reserved automatically, so nobody buys what the shelter already has. Your groceries show as *promised* until the kitchen records them as received.
6. **Plan ingredients: Use pantry.** This is available only when the pantry can cover every remaining ingredient. Confirming reserves that stock for this meal, and no other meal can use it. If anything is short, the page lists the shortages and points you to *Bring groceries*.
7. **Volunteer to serve.** Confirm the serving assignment, which is one booking per meal unless the admin set more.
8. **My commitments.** See upcoming and past commitments. You can change prepared servings or cancel a commitment until the meal starts. Cancelling frees the capacity again.

## Administrator guide

The admin pages cover these tasks:

- **Publish meal plans** (*Meal plans → New*). Set the date, meal, dish, servings, recipe yield, serving capacity and ingredient lines with quantities and units. Save it as a draft (hidden from volunteers) or publish it. Ingredient quantities are written for the recipe yield. The app scales them to the servings the kitchen still has to cook, so prepared-food donations reduce ingredient demand automatically.
- **Edit safely.** An edit that conflicts with existing commitments shows a list of the conflicts first. Saving anyway keeps every volunteer commitment and marks the affected meal *Needs attention*. Cancelling a meal with commitments also asks for confirmation.
- **Pantry** (*Pantry*). Each item shows on hand, reserved, available, pledged (incoming, not yet stock) and open demand. Use *Receipt* for deliveries, *Adjustment* for ± changes, and *Correction* to enter a counted total. Every change is recorded in the item's history. A correction that drops stock below what is reserved names the affected meals and needs confirmation; on confirmation, reservations are reduced starting with the latest meal.
- **Incoming groceries.** When a donor's groceries arrive, record the received quantity. Stock goes up, and the same amount is reserved for that meal.
- **Mark served.** After a meal, *Mark served* turns its reservations into consumption. Do not also subtract that food manually, or the stock will be counted twice.
- **Dashboard.** Shows the next seven days with lane statuses, insufficient ingredients, incoming pledges and meals needing attention.

## Demo walkthrough (steps 1–22)

Run `npm run demo:reset` first. In the table, "Tuesday" means the next Tuesday after the seed date (the seed prints it), and later days count from that Tuesday. The admin creation steps (3–5) can use any open slot. The seeded Tuesday lunch already holds the same chili plan, so the volunteer steps can run straight away.

| Step | Action | Seeded slot / account |
|---|---|---|
| 1 | Open `http://localhost:3000` | none |
| 2 | Enter as Administrator, sign in | `admin` |
| 3–4 | Show or create Tuesday lunch: Chili, 120 servings, 7 ingredients | Tuesday lunch (seeded) |
| 5 | Pantry: beef, tomatoes and chili powder are stocked; beans, onions, peppers and cornbread mix are at 0 | Pantry page |
| 6 | Log out | none |
| 7–8 | Enter as Volunteer, choose Solo | `sam` |
| 9 | Calendar → Tuesday lunch | Tuesday lunch |
| 10–11 | Bring cooked food: 60 servings. Prepared lane turns yellow, 60 remaining | Tuesday lunch |
| 12–13 | Log in as `james`, commit 60. Prepared lane turns gray | Tuesday lunch |
| 14–15 | Fresh scenario: Bring groceries. 7 ingredients, 3 covered by pantry, 4 short | Tuesday dinner (chili grocery scenario) |
| 16–17 | Pledge kidney beans and onions. Ingredient lane turns yellow; peppers and cornbread still needed | Tuesday dinner |
| 18 | Use pantry with sufficient stock. Ingredient lane turns gray, stock reserved | Wednesday lunch (spaghetti) |
| 19 | Volunteer to serve. Serving lane turns gray; food lanes unchanged | Friday breakfast (food covered, serving open) |
| 20 | Log in as `maria`. As St. Paul's Church she sees the church's 60 servings on Thursday lunch; as UAB Hospital Volunteers she sees only "60 remaining" | Thursday lunch (60/120 by the church) |
| 21 | Admin: receipt or correction on a pantry item | Pantry page |
| 22 | The volunteer meal page shows the updated availability | Any meal using that item |

Other seeded states:

| Seeded slot | State |
|---|---|
| Thursday dinner | Fully booked (gray) |
| Saturday dinner | Not scheduled |
| Sunday lunch | Draft, hidden from volunteers |
