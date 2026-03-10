const { initDatabase } = require('./database');
const db = initDatabase();

// Seed sample ideas
const ideas = [
  {
    title: 'Charity Gala Dinner 2026',
    description: 'Ein eleganter Gala-Abend zugunsten des lokalen Kinderspitals. Mit Live-Musik, Tombola und einem 5-Gang-Menue. Der Erloess geht vollumfaenglich an die Kinderklinik Bern.',
    event_date: '2026-06-15',
    event_place: 'Hotel Bellevue Palace, Bern',
    details: 'Budget: ca. CHF 15\'000\nErwartete Gaeste: 120\nDresscode: Black Tie\nMusik: Jazz Quartett\nTombola-Preise von lokalen Sponsoren',
    author_name: 'Hans Mueller',
    status: 'approved'
  },
  {
    title: 'Familien-Wandertag im Emmental',
    description: 'Ein familienfreundlicher Wandertag durch die huegelige Emmentaler Landschaft. Verschiedene Routen fuer alle Fitness-Level mit gemeinsamer Verpflegung am Mittag.',
    event_date: '2026-09-12',
    event_place: 'Treffpunkt: Bahnhof Langnau i.E.',
    details: 'Route A: 12km (sportlich)\nRoute B: 7km (mittel)\nRoute C: 3km (Familien)\nMittagessen: Grillplatz Luederenalp\nAnmeldung bis 1. September',
    author_name: 'Petra Schneider',
    status: 'discussion'
  },
  {
    title: 'Lions Pub Quiz Night',
    description: 'Ein unterhaltsamer Abend mit Quizfragen aus verschiedenen Kategorien. Teams von 4-6 Personen treten gegeneinander an. Wissen, Spass und Geselligkeit stehen im Vordergrund.',
    event_date: '2026-04-25',
    event_place: 'Restaurant Kornhauskeller, Bern',
    details: 'Teams: 4-6 Personen\n6 Runden mit je 10 Fragen\nKategorien: Allgemeinwissen, Sport, Kultur, Schweiz, Musik, Wissenschaft\nPreise fuer die Top 3 Teams',
    author_name: 'Thomas Keller',
    status: 'new'
  },
  {
    title: 'Weihnachtsmarkt-Stand',
    description: 'Wie jedes Jahr koennten wir einen Stand am Berner Weihnachtsmarkt betreiben. Gluehwein, Raclette und handgemachte Geschenke - der Erloess fliesst in unsere Hilfsprojekte.',
    event_date: '2026-12-05',
    event_place: 'Muensterplattform, Bern',
    details: 'Standgebuehr: CHF 800\nPersonalbedarf: 4 Personen pro Schicht\nProdukte: Gluehwein, Raclette, Weihnachtsguetzli\nVerkaufszeit: 10:00-20:00',
    author_name: 'Maria Bernasconi',
    status: 'discussion'
  },
  {
    title: 'Benefiz-Fussballturnier',
    description: 'Ein Fussballturnier gegen andere Service-Clubs der Region. Die Einnahmen gehen an ein Augenlicht-Projekt in Afrika - ganz im Sinne unserer Lions-Mission.',
    event_date: '2026-08-22',
    event_place: 'Sportanlage Neufeld, Bern',
    details: 'Teilnehmende Clubs: Lions, Rotary, Kiwanis\nFormat: 7er-Teams, Gruppenphase + K.O.\nStart: 09:00, Finale ca. 16:00\nVerpflegung: Bratwurst-Stand\nEintritt: CHF 10 (Zuschauer)',
    author_name: 'Lukas Bauer',
    status: 'new'
  }
];

const insertIdea = db.prepare(`
  INSERT INTO ideas (title, description, event_date, event_place, details, author_name, status)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const insertComment = db.prepare(`
  INSERT INTO comments (idea_id, author_name, content)
  VALUES (?, ?, ?)
`);

const insertNps = db.prepare(`
  INSERT INTO nps_scores (idea_id, score, voter_name)
  VALUES (?, ?, ?)
`);

const seedAll = db.transaction(() => {
  // Clear existing data
  db.exec('DELETE FROM nps_scores; DELETE FROM comments; DELETE FROM ideas;');

  for (const idea of ideas) {
    const result = insertIdea.run(idea.title, idea.description, idea.event_date, idea.event_place, idea.details, idea.author_name, idea.status);
    const ideaId = result.lastInsertRowid;

    // Add some comments
    if (idea.status !== 'new') {
      insertComment.run(ideaId, 'Anna Schweizer', 'Super Idee! Bin sofort dabei.');
      insertComment.run(ideaId, 'Peter Huber', 'Klingt grossartig. Wie sieht es mit dem Budget aus?');
      if (idea.status === 'approved') {
        insertComment.run(ideaId, 'Hans Mueller', 'Habe bereits erste Sponsoren kontaktiert. Hotel Bellevue gibt uns 10% Rabatt.');
      }
    }

    // Add some NPS scores
    const scores = [
      [8, 'Anna Schweizer'], [9, 'Peter Huber'], [7, 'Claudia Meier'],
      [10, 'Fritz Gerber'], [6, 'Monika Lehmann']
    ];
    const numScores = idea.status === 'approved' ? 5 : idea.status === 'discussion' ? 3 : 1;
    for (let i = 0; i < numScores; i++) {
      insertNps.run(ideaId, scores[i][0], scores[i][1]);
    }
  }
});

seedAll();
console.log('Database seeded with sample data!');
