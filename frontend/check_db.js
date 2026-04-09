import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kbsamymlnnfrirostqlp.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtic2FteW1sbm5mcmlyb3N0cWxwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzOTIyNjYsImV4cCI6MjA5MDk2ODI2Nn0.u0J5KZ4wSoydwpmyiLABhJ4HK1foV6aXcX7-b1bW4cY';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkSchema() {
  console.log('Checking transactions table...');
  const { data, error } = await supabase.from('transactions').select('*').limit(1);
  if (error) {
    console.log('Error fetching transactions:', error.message);
  } else {
    console.log('Columns in transactions:', Object.keys(data[0] || {}).join(', '));
  }
  
  console.log('\nChecking categories table...');
  const { data: cats, error: catError } = await supabase.from('categories').select('name');
  if (catError) {
    console.log('Error fetching categories:', catError.message);
  } else {
    console.log('Available categories:', cats.map(c => c.name).join(', '));
  }
}

checkSchema();
