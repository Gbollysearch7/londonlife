import type { SkillId } from "./types";

export interface LessonQuestion {
  prompt: string;
  options: [string, string, string, string];
  /** index 0-3 of the correct option */
  answer: number;
}

export interface Lesson {
  title: string;
  /** 3-5 short sentences of study notes the player reads; every quiz answer must be stated or directly implied in these notes. */
  notes: string;
  questions: [LessonQuestion, LessonQuestion, LessonQuestion];
}

export interface CourseDef {
  id: string;
  name: string;
  blurb: string;
  skill: SkillId;
  /** career id that gets a +15% performance benefit once certified */
  career: "tech" | "banking" | "product" | "kitchen" | "community";
  feePence: number; // per lesson, use 3000
  lessons: [Lesson, Lesson, Lesson, Lesson, Lesson];
}

const LESSON_FEE_PENCE = 3000;

const q = (
  prompt: string,
  options: [string, string, string, string],
  answer: number,
): LessonQuestion => ({ prompt, options, answer });

export const COURSES: CourseDef[] = [
  {
    id: "software",
    name: "Software Development Certificate",
    blurb: "Learn the building blocks of programming, from your first variable to your first commit.",
    skill: "coding",
    career: "tech",
    feePence: LESSON_FEE_PENCE,
    lessons: [
      {
        title: "Variables and types",
        notes:
          "A variable is a named container that holds a value, such as a score or a player's name. You can change what is stored in a variable while the program runs. Values come in types: whole numbers are integers, text is called a string, and true-or-false values are booleans. Clear names like totalPrice make code much easier to read than names like x.",
        questions: [
          q("What is a variable?", ["A type of loop", "A named container that holds a value", "An error message", "A file stored on a server"], 1),
          q('What type is a piece of text such as "hello"?', ["Integer", "Boolean", "Loop", "String"], 3),
          q("Which variable name is clearest?", ["totalPrice", "x", "thing2", "a1b2"], 0),
        ],
      },
      {
        title: "Loops",
        notes:
          "A loop repeats a block of code so you don't have to write it out many times. A for loop is handy when you know how many times to repeat, such as once for each item in a list. A while loop keeps going as long as a condition stays true. If that condition never becomes false, you get an infinite loop that never stops.",
        questions: [
          q("What does a loop do?", ["Stores a single value", "Deletes old code", "Repeats a block of code", "Names a function"], 2),
          q("What happens if a while loop's condition never becomes false?", ["It runs exactly once", "It becomes an infinite loop", "It turns into a for loop", "It skips straight to the end"], 1),
          q("Which suits going through each item in a list?", ["An infinite loop", "A boolean", "A string", "A for loop"], 3),
        ],
      },
      {
        title: "Functions",
        notes:
          "A function is a reusable, named set of instructions that does one job. You pass information into a function through its parameters. A function can hand a result back using a return value. Breaking a big program into small functions makes it easier to test and reuse.",
        questions: [
          q("What is a function?", ["A reusable, named set of instructions", "A list of error codes", "A variable that only stores text", "A backup of your project"], 0),
          q("How do you pass information into a function?", ["Through comments", "Through the file name", "Through parameters", "Through a loop counter"], 2),
          q("What is a return value?", ["The first line of a function", "The result a function hands back", "A value that can never change", "The name of the function"], 1),
        ],
      },
      {
        title: "Debugging",
        notes:
          "A bug is a mistake in code that makes a program behave in an unexpected way. Error messages often tell you the line where things went wrong, so read them carefully. Printing values as the program runs helps you see what is really happening. Explaining your code out loud, line by line, is another good way to spot the problem.",
        questions: [
          q("What is a bug?", ["A new feature request", "A very fast computer", "A comment in the code", "A mistake that makes a program behave unexpectedly"], 3),
          q("What useful clue do error messages often give?", ["The line where things went wrong", "The programmer's name", "How much memory is free", "The date the file was created"], 0),
          q("Why print values while a program runs?", ["To make the program faster", "To remove the bug automatically", "To see what is really happening", "To rename your variables"], 2),
        ],
      },
      {
        title: "Version control and testing",
        notes:
          "Version control keeps a history of changes to your code, so you can go back if something breaks. Each saved snapshot of changes is called a commit, with a short message explaining what changed. A branch lets you work on a new idea without disturbing the main code. Automated tests check that your code still does what it should after every change.",
        questions: [
          q("What does version control keep?", ["A list of your users", "A history of changes to your code", "Your passwords", "A copy of the internet"], 1),
          q("What is a saved snapshot of changes called?", ["A loop", "A parameter", "A string", "A commit"], 3),
          q("What do automated tests check?", ["That code still does what it should", "How many lines the file has", "Which font the editor uses", "How fast you type"], 0),
        ],
      },
    ],
  },
  {
    id: "finance",
    name: "Personal Finance & Banking",
    blurb: "Get confident with budgets, interest, credit and inflation, the everyday maths of money.",
    skill: "enterprise",
    career: "banking",
    feePence: LESSON_FEE_PENCE,
    lessons: [
      {
        title: "Budgeting",
        notes:
          "A budget is a plan for how you will spend and save the money that comes in. Start by listing your income, then your essential costs such as rent, bills and food. Whatever is left can go towards savings, treats and goals. Checking your budget each month helps you notice when spending starts to drift.",
        questions: [
          q("What is a budget?", ["A type of bank account", "A loan from a friend", "A plan for spending and saving your money", "A tax form"], 2),
          q("Which of these is an essential cost?", ["A concert ticket", "Rent", "A new games console", "A weekend away"], 1),
          q("Why check your budget each month?", ["To raise your income automatically", "To close your bank account", "To avoid paying bills", "To notice when spending drifts"], 3),
        ],
      },
      {
        title: "Simple and compound interest",
        notes:
          "Interest is the price of borrowing money, or the reward for saving it. Simple interest is worked out only on the original amount. Compound interest is worked out on the original amount plus any interest already added, so it grows faster over time. For example, £100 at 10% simple interest earns £10 every year.",
        questions: [
          q("Simple interest is calculated on…", ["Only the original amount", "The original amount plus earlier interest", "Your monthly spending", "The bank's profits"], 0),
          q("Why does compound interest grow faster than simple interest?", ["It is only charged once", "It ignores the original amount", "It is also calculated on interest already added", "It is paid in cash"], 2),
          q("How much does £100 earn in one year at 10% simple interest?", ["£1", "£10", "£100", "£110"], 1),
        ],
      },
      {
        title: "Saving versus borrowing",
        notes:
          "Saving means setting money aside now so you can use it later. Borrowing lets you have something now, but you usually pay back more than you borrowed because of interest. An emergency fund is savings kept for unexpected costs, like a broken boiler. Having one can mean you don't need to borrow when the unexpected happens.",
        questions: [
          q("Why do you usually pay back more than you borrowed?", ["Because of bank holidays", "Because savings shrink", "Because of the exchange rate", "Because of interest"], 3),
          q("What is an emergency fund?", ["Savings kept for unexpected costs", "A loan for holidays", "A type of credit card", "Money owed to a friend"], 0),
          q("How can an emergency fund help?", ["It doubles your wages", "It removes all your bills", "It can mean you don't need to borrow", "It raises your interest rate"], 2),
        ],
      },
      {
        title: "Credit and APR",
        notes:
          "Credit is money you can borrow now and repay later, for example with a credit card or a loan. APR stands for annual percentage rate, and it shows the yearly cost of borrowing, including interest and certain fees. A lower APR generally means borrowing costs less. Paying on time helps build a good credit history, which lenders look at.",
        questions: [
          q("What does APR stand for?", ["Average payment ratio", "Annual percentage rate", "Automatic pay rise", "Annual profit return"], 1),
          q("Generally, a lower APR means…", ["You can't borrow at all", "You earn more interest", "The loan lasts longer", "Borrowing costs less"], 3),
          q("What helps build a good credit history?", ["Paying on time", "Missing payments", "Ignoring letters from lenders", "Always borrowing the maximum"], 0),
        ],
      },
      {
        title: "Inflation",
        notes:
          "Inflation is the general rise in prices over time. When prices rise, each pound buys a little less than before, so money loses purchasing power. If your savings earn less interest than the rate of inflation, their real value falls. That is why people compare interest rates with inflation when thinking about savings.",
        questions: [
          q("What is inflation?", ["A fall in wages", "A type of savings account", "The general rise in prices over time", "A bank charge"], 2),
          q("When prices rise, what happens to each pound?", ["It buys more", "It buys a little less", "It doubles in value", "It stays exactly the same"], 1),
          q("If savings earn less interest than inflation, their real value…", ["Rises", "Doubles", "Stays fixed", "Falls"], 3),
        ],
      },
    ],
  },
  {
    id: "product",
    name: "Product Management Foundations",
    blurb: "Discover how good products get made: listen to users, frame the problem, ship small and measure.",
    skill: "enterprise",
    career: "product",
    feePence: LESSON_FEE_PENCE,
    lessons: [
      {
        title: "User research",
        notes:
          "User research means learning about the people you are building for before deciding what to build. Interviews let you hear about their goals, habits and frustrations in their own words. Ask open questions, such as 'Tell me about the last time you…', rather than leading ones. Watching what people actually do is often more revealing than what they say they do.",
        questions: [
          q("What is user research?", ["Learning about the people you build for", "Writing the final code", "Setting the product's price", "Designing the logo"], 0),
          q("Which of these is an open question?", ["Do you like our app?", "Would you pay £5 for this?", "Tell me about the last time you shopped for groceries.", "Isn't this feature great?"], 2),
          q("What is often more revealing than what people say?", ["What rival products advertise", "Watching what people actually do", "The team's opinion", "A lucky guess"], 1),
        ],
      },
      {
        title: "Problem statements",
        notes:
          "A problem statement describes who is struggling, what they are trying to do, and why it matters. It focuses on the user's problem, not on a particular solution. A good one might read: 'Busy parents need a quick way to plan weekly meals because they run out of time in the evenings.' Clear problem statements keep the whole team pointed at the same goal.",
        questions: [
          q("A problem statement should focus on…", ["A specific solution", "The team's favourite feature", "The launch date", "The user's problem"], 3),
          q("What does a problem statement describe?", ["Who is struggling, what they're trying to do and why it matters", "The product's colour scheme", "The marketing budget", "The office layout"], 0),
          q("Why are clear problem statements useful?", ["They replace all research", "They guarantee success", "They keep the team pointed at the same goal", "They decide everyone's salary"], 2),
        ],
      },
      {
        title: "Minimum viable products",
        notes:
          "An MVP, or minimum viable product, is the simplest version of a product that lets you learn whether an idea works. It includes only the core features needed to test your main assumption. Releasing an MVP early means you get real feedback before spending lots of time and money. What you learn then shapes the next version.",
        questions: [
          q("What does MVP stand for here?", ["Most valuable player", "Minimum viable product", "Maximum visible price", "Main version plan"], 1),
          q("What should an MVP include?", ["Every possible feature", "Features nobody asked for", "A finished advertising campaign", "Only the core features needed to test the main assumption"], 3),
          q("Why release an MVP early?", ["To get real feedback before spending lots of time and money", "To avoid talking to users", "So you never need a second version", "To skip testing altogether"], 0),
        ],
      },
      {
        title: "Prioritisation",
        notes:
          "Prioritisation means deciding what to work on first, because there is never time for everything. A simple way is to weigh each idea's value to users against the effort it takes. High-value, low-effort ideas are often good places to start. Saying 'not now' to some requests is a normal and healthy part of the job.",
        questions: [
          q("Why do teams prioritise?", ["To make work last longer", "To avoid users", "Because there is never time for everything", "To spend more money"], 2),
          q("Which kind of idea is often a good place to start?", ["Low value, high effort", "High value, low effort", "Low value, low effort", "High effort, unknown value"], 1),
          q("Saying 'not now' to some requests is…", ["A sign of failure", "Against the rules", "Something to avoid at all costs", "A normal, healthy part of the job"], 3),
        ],
      },
      {
        title: "Measuring outcomes",
        notes:
          "Shipping a feature is not the finish line; what matters is whether it changed things for users. An outcome is the result you hope for, like more people completing sign-up. Pick a metric that tracks that outcome and measure it before and after the change. Comparing the two tells you whether the work helped.",
        questions: [
          q("What is an outcome?", ["The result you hope for, such as more people completing sign-up", "The number of meetings held", "The lines of code written", "The date a feature ships"], 0),
          q("When should you measure your metric?", ["Only after launch", "Never, just trust your instinct", "Before and after the change", "Only during planning"], 2),
          q("What matters most after shipping a feature?", ["How quickly it shipped", "Whether it changed things for users", "How many people built it", "How tidy the code looks"], 1),
        ],
      },
    ],
  },
  {
    id: "culinary",
    name: "Professional Kitchen Skills",
    blurb: "Work safely, cleanly and calmly on the pass, and make every plate taste properly seasoned.",
    skill: "cooking",
    career: "kitchen",
    feePence: LESSON_FEE_PENCE,
    lessons: [
      {
        title: "Knife safety",
        notes:
          "A sharp knife is safer than a blunt one because it cuts cleanly and is less likely to slip. Curl the fingertips of your guiding hand into a 'claw' so your knuckles guide the blade. Place a damp cloth under your chopping board to stop it sliding. Never try to catch a falling knife; step back and let it drop.",
        questions: [
          q("Why is a sharp knife safer than a blunt one?", ["It is heavier", "It stays cleaner", "It never needs washing", "It is less likely to slip"], 3),
          q("How should you hold your guiding hand?", ["Fingertips curled into a claw", "Flat with fingers spread", "Gripping the blade", "Behind your back"], 0),
          q("What should you do if a knife falls?", ["Catch it by the handle", "Catch it with a cloth", "Step back and let it drop", "Kick it out of the way"], 2),
        ],
      },
      {
        title: "Food hygiene",
        notes:
          "Wash your hands with soap and warm water before handling food and after touching raw meat. Keep raw and cooked foods apart, using separate boards and utensils, to avoid cross-contamination. Chilled foods belong in the fridge, which should be kept at 5°C or below. Cooked food you plan to store should be cooled quickly and then refrigerated.",
        questions: [
          q("When should you wash your hands?", ["Only at the end of a shift", "Before handling food and after touching raw meat", "Only when they look dirty", "Once a day"], 1),
          q("Why keep raw and cooked foods apart?", ["To save fridge space", "To improve the flavour", "To make them cook faster", "To avoid cross-contamination"], 3),
          q("What temperature should a fridge be kept at?", ["5°C or below", "10°C", "15°C", "Room temperature"], 0),
        ],
      },
      {
        title: "Mise en place",
        notes:
          "Mise en place is French for 'everything in its place'. It means preparing and arranging all your ingredients and equipment before you start cooking. Chopping, measuring and laying things out first keeps service calm and fast. It also helps you spot a missing ingredient before it is too late.",
        questions: [
          q("What does mise en place mean?", ["Cook it quickly", "Taste as you go", "Everything in its place", "Serve it hot"], 2),
          q("When do you do your mise en place?", ["After serving", "Before you start cooking", "Halfway through cooking", "Only at closing time"], 1),
          q("Which is a benefit of mise en place?", ["It removes the need to taste", "It makes food spicier", "It replaces food hygiene", "It helps you spot a missing ingredient early"], 3),
        ],
      },
      {
        title: "Cooking methods",
        notes:
          "Boiling cooks food in water at a full, rolling bubble, which suits pasta. Simmering uses gentler heat, with small bubbles just breaking the surface, and is ideal for soups and stews. Sautéing means cooking quickly in a little fat in a hot pan. Roasting uses the dry heat of an oven, giving meat and vegetables a browned outside.",
        questions: [
          q("According to the notes, which method suits pasta?", ["Boiling", "Roasting", "Sautéing", "Chilling"], 0),
          q("What does simmering look like?", ["A full, rolling bubble", "No heat at all", "Small bubbles just breaking the surface", "Smoke rising from the pan"], 2),
          q("What is sautéing?", ["Cooking slowly in lots of water", "Cooking quickly in a little fat in a hot pan", "Cooking in the dry heat of an oven", "Freezing food quickly"], 1),
        ],
      },
      {
        title: "Seasoning and tasting",
        notes:
          "Seasoning means adding salt, pepper, acid or herbs to bring out a dish's flavour. Add seasoning a little at a time, because it is easy to add more but hard to take it away. Taste as you cook, using a clean spoon each time. A squeeze of lemon or a splash of vinegar can brighten a dish that tastes flat.",
        questions: [
          q("Why add seasoning a little at a time?", ["Salt is expensive", "It makes food cook faster", "Pepper burns easily", "It's easy to add more but hard to take away"], 3),
          q("How should you taste as you cook?", ["With a clean spoon each time", "With your fingers", "Straight from the ladle", "With the same spoon throughout"], 0),
          q("What can brighten a dish that tastes flat?", ["More water", "A longer rest", "A squeeze of lemon", "Extra flour"], 2),
        ],
      },
    ],
  },
  {
    id: "community",
    name: "Community Leadership",
    blurb: "Bring your neighbours together: listen well, run fair meetings, and turn ideas into events.",
    skill: "charisma",
    career: "community",
    feePence: LESSON_FEE_PENCE,
    lessons: [
      {
        title: "Active listening",
        notes:
          "Active listening means giving someone your full attention so they feel truly heard. Put your phone away, make comfortable eye contact and let them finish without interrupting. Then reflect back what you heard in your own words, such as 'So you're worried about the park closing?'. Asking open questions helps people share more.",
        questions: [
          q("What is active listening?", ["Waiting for your turn to speak", "Giving someone your full attention so they feel heard", "Taking notes on your phone", "Agreeing with everything they say"], 1),
          q("What does reflecting back mean?", ["Ignoring what was said", "Changing the subject", "Giving advice straight away", "Repeating what you heard in your own words"], 3),
          q("What helps people share more?", ["Asking open questions", "Interrupting often", "Checking your phone", "Finishing their sentences for them"], 0),
        ],
      },
      {
        title: "Running an inclusive meeting",
        notes:
          "An inclusive meeting is one where everyone can take part. Share an agenda beforehand so people know what will be discussed. Choose an accessible venue and time, and invite quieter members to speak by going round the room. End by summarising the decisions made and who will do what.",
        questions: [
          q("Why share an agenda beforehand?", ["To make the meeting longer", "To keep the topics secret", "So people know what will be discussed", "So nobody needs to attend"], 2),
          q("How can you include quieter members?", ["Let the loudest person lead", "Go round the room inviting each person to speak", "Skip questions entirely", "Hold the meeting late at night"], 1),
          q("How should the meeting end?", ["With no conclusions", "Abruptly when time runs out", "By handing out a new agenda only", "By summarising decisions and who will do what"], 3),
        ],
      },
      {
        title: "Coordinating volunteers",
        notes:
          "Good volunteer coordination matches people's skills and availability to the right tasks. Give every volunteer a clear role and a named person to ask for help. A short welcome briefing helps new volunteers feel confident. Saying thank you, and meaning it, keeps people coming back.",
        questions: [
          q("Good coordination matches people's skills and availability to…", ["The right tasks", "The longest shifts", "Random jobs", "Whatever is left over"], 0),
          q("What should every volunteer have?", ["A uniform they buy themselves", "A long contract", "A clear role and a named person to ask for help", "A strict weekly target"], 2),
          q("What keeps volunteers coming back?", ["Longer shifts", "A sincere thank you", "Stricter rules", "Fewer briefings"], 1),
        ],
      },
      {
        title: "Calming conflict",
        notes:
          "When a disagreement heats up, stay calm and keep your own voice low and steady. Acknowledge the other person's feelings, for example 'I can see this really matters to you'. Focus on the issue rather than the person. If things stay heated, suggest a short break and come back to it later.",
        questions: [
          q("How should you keep your voice in a heated moment?", ["Loud and firm", "Completely silent", "Sharp and sarcastic", "Low and steady"], 3),
          q("What should you focus on?", ["The issue rather than the person", "Winning the argument", "Who started it", "The person's past mistakes"], 0),
          q("What can you suggest if things stay heated?", ["Ending the friendship", "Raising your voices", "A short break, then coming back to it", "Voting them out of the group"], 2),
        ],
      },
      {
        title: "Planning a community event",
        notes:
          "Start planning a community event by agreeing its purpose and who it is for. Set a budget and a date, then book a venue that is easy to reach. Make a simple checklist of tasks with a name next to each one. Afterwards, ask attendees for feedback so the next event is even better.",
        questions: [
          q("What should you agree first?", ["The colour of the posters", "The event's purpose and who it is for", "The music playlist", "The menu"], 1),
          q("What goes next to each task on the checklist?", ["A price tag", "A random number", "A question mark", "A name"], 3),
          q("Why ask attendees for feedback afterwards?", ["So the next event is even better", "To find someone to blame", "To fill the time", "To cancel future events"], 0),
        ],
      },
    ],
  },
];

export const courseDef = (id: string) => COURSES.find((c) => c.id === id);
