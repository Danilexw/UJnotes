// Configure suas credenciais do Supabase aqui
const supabaseUrl = 'https://viwmoqvoltezdeleqkbw.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpd21vcXZvbHRlemRlbGVxa2J3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjcxMzc0OSwiZXhwIjoyMTAyMjg5NzQ5fQ.Jea2MyGBbDP3kMej94RZpzxjM5cU8o5d5GkmBTs-QXU';

// Sobrescreve a biblioteca global com a conexão do seu banco
window.supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

console.log("Supabase inicializado com sucesso!");
