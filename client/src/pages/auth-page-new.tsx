import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { LoginUser } from "@shared/schema";
import { Hospital, ClipboardCheck, User, Lock } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

// Login form schema
const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
  rememberMe: z.boolean().optional(),
});

// Export AuthPage component
export default function AuthPage() {
  const [location, navigate] = useLocation();
  const { user, loginMutation } = useAuth();

  // Redirect if user is already logged in
  useEffect(() => {
    if (user) {
      navigate("/");
    }
  }, [user, navigate]);

  // Login form
  const loginForm = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
      rememberMe: false,
    },
  });

  // Handle login submission
  const onLoginSubmit = (data: z.infer<typeof loginSchema>) => {
    const loginData: LoginUser = {
      username: data.username,
      password: data.password,
    };
    loginMutation.mutate(loginData);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-200 p-4">
      <div className="w-full max-w-6xl grid md:grid-cols-2 shadow-lg rounded-lg overflow-hidden">
        {/* Form section */}
        <Card className="border-0 shadow-none">
          <CardHeader className="space-y-1 text-center">
            <div className="flex justify-center mb-2">
              <Hospital className="h-12 w-12 text-primary" />
            </div>
            <CardTitle className="text-2xl font-bold">Stock Well</CardTitle>
            <CardDescription>
              Enter your credentials to access the system
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...loginForm}>
              <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
                <FormField
                  control={loginForm.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input placeholder="Enter your username" {...field} className="pl-10" />
                          <User className="absolute left-3 top-3 h-4 w-4 text-neutral-400" />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={loginForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input type="password" placeholder="Enter your password" {...field} className="pl-10" />
                          <Lock className="absolute left-3 top-3 h-4 w-4 text-neutral-400" />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={loginForm.control}
                  name="rememberMe"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Remember me</FormLabel>
                      </div>
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  className="w-full"
                  disabled={loginMutation.isPending}
                >
                  {loginMutation.isPending ? "Signing in..." : "Sign In"}
                </Button>
                <div className="text-center text-sm text-muted-foreground">
                  <p>Only administrators can register new staff accounts</p>
                </div>
              </form>
            </Form>
          </CardContent>
          <CardFooter className="text-center text-sm text-neutral-500">
            <p className="w-full">
              By signing in, you agree to our Terms of Service and Privacy Policy.
            </p>
          </CardFooter>
        </Card>

        {/* Hero section */}
        <div className="bg-primary hidden md:flex items-center justify-center">
          <div className="px-8 py-12 max-w-md text-white">
            <div className="flex justify-center mb-8">
              <ClipboardCheck className="h-20 w-20" />
            </div>
            <h2 className="text-3xl font-bold mb-6">Hospital Inventory Management System</h2>
            <p className="text-lg mb-6">
              Efficiently manage your hospital's inventory with our comprehensive tracking and management system.
            </p>
            <ul className="space-y-3">
              <li className="flex items-center">
                <div className="mr-2 h-5 w-5 bg-white rounded-full flex items-center justify-center">
                  <div className="h-3 w-3 bg-primary rounded-full"></div>
                </div>
                <span>Role-based access control</span>
              </li>
              <li className="flex items-center">
                <div className="mr-2 h-5 w-5 bg-white rounded-full flex items-center justify-center">
                  <div className="h-3 w-3 bg-primary rounded-full"></div>
                </div>
                <span>Real-time stock level tracking</span>
              </li>
              <li className="flex items-center">
                <div className="mr-2 h-5 w-5 bg-white rounded-full flex items-center justify-center">
                  <div className="h-3 w-3 bg-primary rounded-full"></div>
                </div>
                <span>Comprehensive reporting tools</span>
              </li>
              <li className="flex items-center">
                <div className="mr-2 h-5 w-5 bg-white rounded-full flex  items-center justify-center">
                  <div className="h-3 w-3 bg-primary rounded-full"></div>
                </div>
                <span>Low stock alerts and notifications</span>
              </li>
              <li className="flex items-center">
                <div className="mr-2 h-5 w-5 bg-white rounded-full flex items-center justify-center">
                  <div className="h-3 w-3 bg-primary rounded-full"></div>
                </div>
                <span>SQL Server database integration</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}