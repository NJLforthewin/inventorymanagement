import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppLayout } from "@/components/layout/app-layout";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { 
  Form, 
  FormControl, 
  FormDescription, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2, Database, RefreshCw, Send } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";

// Form schema for SQL Server configuration
const sqlConfigSchema = z.object({
  server: z.string().min(1, "Server is required"),
  database: z.string().min(1, "Database name is required"),
  user: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

type SqlConfigValues = z.infer<typeof sqlConfigSchema>;

// Form schema for SQL query execution
const sqlQuerySchema = z.object({
  query: z.string().min(1, "SQL query is required"),
});

type SqlQueryValues = z.infer<typeof sqlQuerySchema>;

export default function SqlServerPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("connection");
  const [queryResult, setQueryResult] = useState<any>(null);

  // Connection test
  const { data: connectionStatus, refetch: testConnection, isLoading: isTesting } = useQuery({
    queryKey: ["/api/sql-connection-test"],
    queryFn: async () => {
      const response = await fetch("/api/sql-connection-test");
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to test connection");
      }
      return response.json();
    },
    enabled: false, // Don't run on component mount
  });

  // Form for SQL Server configuration
  const configForm = useForm<SqlConfigValues>({
    resolver: zodResolver(sqlConfigSchema),
    defaultValues: {
      server: "",
      database: "",
      user: "",
      password: "",
    }
  });

  // Form for SQL query execution
  const queryForm = useForm<SqlQueryValues>({
    resolver: zodResolver(sqlQuerySchema),
    defaultValues: {
      query: "SELECT TOP 10 * FROM INFORMATION_SCHEMA.TABLES",
    }
  });

  // Mutation for executing SQL queries
  const executeMutation = useMutation({
    mutationFn: async (data: SqlQueryValues) => {
      const res = await apiRequest("POST", "/api/sql-query", data);
      return await res.json();
    },
    onSuccess: (data) => {
      setQueryResult(data.data);
      toast({
        title: "Query executed successfully",
        description: "Your SQL query has been executed successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Query execution failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Test connection function
  const handleTestConnection = () => {
    testConnection();
  };

  // Execute SQL query
  const onQuerySubmit = (data: SqlQueryValues) => {
    executeMutation.mutate(data);
  };

  // Update SQL Server config
  const onConfigSubmit = (data: SqlConfigValues) => {
    toast({
      title: "Feature not implemented",
      description: "Updating SQL Server configuration requires environment variables to be set on the server.",
    });
  };

  return (
    <AppLayout title="SQL Server Integration">
      <div className="flex justify-end mb-6">
        <Button onClick={handleTestConnection} disabled={isTesting} variant="outline">
          {isTesting ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Testing...
            </>
          ) : (
            <>
              <Database className="mr-2 h-4 w-4" />
              Test Connection
            </>
          )}
        </Button>
      </div>

      {connectionStatus && (
        <Alert variant={connectionStatus.status === "success" ? "default" : "destructive"}>
          {connectionStatus.status === "success" ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          <AlertTitle>{connectionStatus.status === "success" ? "Connection Successful" : "Connection Failed"}</AlertTitle>
          <AlertDescription>{connectionStatus.message}</AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="connection">Connection Settings</TabsTrigger>
          <TabsTrigger value="query">Query Execution</TabsTrigger>
        </TabsList>

        <TabsContent value="connection" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>SQL Server Connection Settings</CardTitle>
              <CardDescription>
                Configure your SQL Server connection parameters.
                <Badge variant="outline" className="ml-2">
                  Admin Only
                </Badge>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...configForm}>
                <form onSubmit={configForm.handleSubmit(onConfigSubmit)} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={configForm.control}
                      name="server"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Server</FormLabel>
                          <FormControl>
                            <Input placeholder="localhost or IP address" {...field} />
                          </FormControl>
                          <FormDescription>
                            The hostname or IP address of your SQL Server
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={configForm.control}
                      name="database"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Database</FormLabel>
                          <FormControl>
                            <Input placeholder="HospitalInventory" {...field} />
                          </FormControl>
                          <FormDescription>
                            The name of your database
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={configForm.control}
                      name="user"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Username</FormLabel>
                          <FormControl>
                            <Input placeholder="sa" {...field} />
                          </FormControl>
                          <FormDescription>
                            SQL Server authentication username
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={configForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="••••••••" {...field} />
                          </FormControl>
                          <FormDescription>
                            SQL Server authentication password
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex justify-end">
                    <Button type="submit">
                      Save Configuration
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
            </TabsContent>

            <TabsContent value="query" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Execute SQL Query</CardTitle>
                  <CardDescription>
                    Run a SQL query directly against your SQL Server database.
                    <Badge variant="outline" className="ml-2">
                      Admin Only
                    </Badge>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...queryForm}>
                    <form onSubmit={queryForm.handleSubmit(onQuerySubmit)} className="space-y-6">
                      <FormField
                        control={queryForm.control}
                        name="query"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>SQL Query</FormLabel>
                            <FormControl>
                              <Textarea 
                                placeholder="SELECT * FROM YourTable" 
                                className="font-mono h-36"
                                {...field} 
                              />
                            </FormControl>
                            <FormDescription>
                              Enter a valid T-SQL query to execute
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="flex justify-end">
                        <Button 
                          type="submit" 
                          disabled={executeMutation.isPending}
                        >
                          {executeMutation.isPending ? (
                            <>
                              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                              Executing...
                            </>
                          ) : (
                            <>
                              <Send className="mr-2 h-4 w-4" />
                              Execute Query
                            </>
                          )}
                        </Button>
                      </div>
                    </form>
                  </Form>

                  {queryResult && (
                    <div className="mt-6">
                      <h3 className="text-lg font-medium mb-2">Query Results</h3>
                      <div className="rounded-md border">
                        <div className="overflow-x-auto">
                          {queryResult.recordset && queryResult.recordset.length > 0 ? (
                            <table className="min-w-full divide-y divide-border">
                              <thead>
                                <tr className="bg-muted/50">
                                  {Object.keys(queryResult.recordset[0]).map((key) => (
                                    <th
                                      key={key}
                                      className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider"
                                    >
                                      {key}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border bg-background">
                                {queryResult.recordset.map((row: any, i: number) => (
                                  <tr key={i}>
                                    {Object.values(row).map((value: any, j: number) => (
                                      <td key={j} className="px-4 py-3 text-sm">
                                        {value === null ? (
                                          <span className="text-muted-foreground italic">NULL</span>
                                        ) : typeof value === 'object' ? (
                                          JSON.stringify(value)
                                        ) : (
                                          String(value)
                                        )}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          ) : (
                            <div className="p-4 text-center text-muted-foreground">
                              No records returned
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="mt-4 text-sm text-muted-foreground">
                        {queryResult.rowsAffected && queryResult.rowsAffected[0] !== undefined && (
                          <p>Rows affected: {queryResult.rowsAffected[0]}</p>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
    </AppLayout>
  );
}