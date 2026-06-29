import odbc from 'odbc';

async function checkOpenDate() {
  try {
    const connection = await odbc.connect('Driver={SQL Anywhere 17};Server=posrental;UID=dba;PWD=sql');
    const result = await connection.query('SELECT OpenDate FROM dba.CurrentOpenDay');
    console.log("Type:", typeof result[0].OpenDate);
    console.log("Value:", result[0].OpenDate);
    
    if (result[0].OpenDate instanceof Date) {
        console.log("It is a Date object");
    }
  } catch(e) {
    console.error(e);
  }
}
checkOpenDate();
