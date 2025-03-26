const supabase = require('./supabase/supabaseClient');

async function testDatabaseConnection() {
  try {
    console.log('Testing Supabase connection...');
    
    // Check if we have valid credentials
    const { data: tableInfo, error: tableError } = await supabase
      .from('marketplace_listings')
      .select('*')
      .limit(1);
    
    if (tableError) {
      console.error('Error accessing marketplace_listings table:', tableError);
      
      // Check if table exists
      if (tableError.code === '42P01') {
        console.error('Table "marketplace_listings" does not exist. Please create it first.');
      } else if (tableError.code === 'PGRST116') {
        console.error('Authentication error. Check your Supabase API key and URL.');
      }
    } else {
      console.log('Successfully connected to marketplace_listings table');
      console.log('Table info:', tableInfo);
    }
    
    // List all tables (requires admin privileges)
    try {
      const { data, error } = await supabase.rpc('get_tables');
      if (error) {
        console.error('Error listing tables:', error);
      } else {
        console.log('Available tables:', data);
      }
    } catch (err) {
      console.log('Cannot list tables. This may require admin privileges.');
    }
    
  } catch (err) {
    console.error('Connection test failed:', err);
  }
}

testDatabaseConnection(); 